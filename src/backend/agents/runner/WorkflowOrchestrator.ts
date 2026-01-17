/**
 * WorkflowOrchestrator - Manages workflow lifecycle and stage transitions
 *
 * Handles:
 * - Creating new workflows
 * - Processing stage-completion tools (scope_card_submit, plan_submit, etc.)
 * - Managing approval gates (most transitions require user approval)
 * - Spawning appropriate agents for each stage
 */

import { findRepoRoot } from "@/backend/git";
import { getWorktreePath } from "@/backend/git/worktree";
import { log } from "@/backend/logger";
import type {
	ArtifactRepository,
	ConversationRepository,
	Pulse,
	PulseRepository,
	WorkflowRepository,
} from "@/backend/repositories";
import { PulseOrchestrator } from "@/backend/services/pulsing";
import { broadcast } from "@/backend/ws";
import {
	createWorkflowApprovalNeededEvent,
	createWorkflowCompletedEvent,
	createWorkflowCreatedEvent,
	createWorkflowErrorEvent,
	createWorkflowStageChangedEvent,
} from "@/shared/schemas/events";
import type { ModelScenario } from "@/shared/schemas/settings";
import type { WorkflowStatus } from "@/shared/schemas/workflow";
import {
	APPROVAL_REQUIRED_TOOLS,
	AUTO_TRANSITION_TOOLS,
	STAGE_TRANSITIONS,
	type Workflow,
} from "@/shared/schemas/workflow";
import { AgentRunner } from "./AgentRunner";
import type { SessionManager } from "./SessionManager";
import type { ArtifactType, StageTransitionResult } from "./types";

// =============================================================================
// Constants
// =============================================================================

/** Maps workflow status to agent role */
const STAGE_TO_AGENT: Record<WorkflowStatus, ModelScenario> = {
	backlog: "scoping", // When moved from backlog, starts with scoping
	scoping: "scoping",
	researching: "research",
	planning: "planning",
	in_progress: "preflight", // Starts with preflight, then execution for each pulse
	review: "review",
	done: "basic", // No agent needed for done state
};

/** Maps tool names to artifact types for the pending_artifact_type column */
const TOOL_TO_ARTIFACT_TYPE: Record<string, ArtifactType> = {
	submit_scope: "scope_card",
	submit_research: "research",
	submit_plan: "plan",
	complete_review: "review",
};

// =============================================================================
// WorkflowOrchestrator
// =============================================================================

export class WorkflowOrchestrator {
	private pulseOrchestrator: PulseOrchestrator;

	constructor(
		private sessionManager: SessionManager,
		private workflowRepo: WorkflowRepository,
		private artifactRepo: ArtifactRepository,
		private conversationRepo: ConversationRepository,
		private pulseRepo: PulseRepository,
	) {
		this.pulseOrchestrator = new PulseOrchestrator({
			pulseRepo: this.pulseRepo,
			projectRoot: findRepoRoot(process.cwd()),
		});
	}

	// ===========================================================================
	// Workflow Creation
	// ===========================================================================

	/**
	 * Create a new workflow and start the scoping agent
	 */
	async createWorkflow(
		title: string,
		description?: string,
		priority: "low" | "medium" | "high" | "urgent" = "medium",
	): Promise<Workflow> {
		// Create workflow using repository
		const workflow = await this.workflowRepo.create({
			title,
			description,
			priority,
			status: "scoping",
		});

		// Broadcast creation event
		broadcast(
			createWorkflowCreatedEvent({
				workflowId: workflow.id,
				title,
				status: "scoping",
			}),
		);

		// Start the scoping agent session
		const session = await this.sessionManager.startSession({
			contextType: "workflow",
			contextId: workflow.id,
			agentRole: "scoping",
		});

		// Update workflow with session ID
		await this.workflowRepo.setCurrentSession(workflow.id, session.id);

		// Build the initial prompt from title and description
		const initialPrompt = description ? `${title}\n\n${description}` : title;

		// Run the scoping agent with the initial prompt (non-blocking)
		const projectRoot = findRepoRoot(process.cwd());
		const runner = new AgentRunner(session, {
			projectRoot,
			conversationRepo: this.conversationRepo,
		});

		runner.run(initialPrompt).catch((error) => {
			log.agent.error(
				`Scoping agent failed for workflow ${workflow.id}:`,
				error,
			);
			this.sessionManager.errorSession(
				session.id,
				error instanceof Error ? error.message : "Unknown error",
			);
		});

		return {
			...workflow,
			currentSessionId: session.id,
		};
	}

	// ===========================================================================
	// Stage Transition Handling
	// ===========================================================================

	/**
	 * Handle a stage-completion tool result
	 *
	 * For approval-required tools: saves artifact, sets awaiting_approval
	 * For auto-transition tools: transitions immediately
	 * For complete_preflight: starts execution with first pulse
	 */
	async handleToolResult(
		workflowId: string,
		toolName: string,
		artifactId: string,
	): Promise<StageTransitionResult> {
		log.workflow.info(
			`handleToolResult: workflowId=${workflowId}, toolName=${toolName}, artifactId=${artifactId}`,
		);

		// Handle preflight completion - starts first pulse
		if (toolName === "complete_preflight") {
			await this.handlePreflightCompletion(workflowId);
			return { transitioned: false, awaitingApproval: false };
		}

		// Check if this is an approval-required tool
		const approvalTargetStage = APPROVAL_REQUIRED_TOOLS[toolName];
		if (approvalTargetStage) {
			const artifactType = TOOL_TO_ARTIFACT_TYPE[toolName];
			if (!artifactType) {
				log.workflow.error(`No artifact type mapping for tool ${toolName}`);
				return { transitioned: false, awaitingApproval: false };
			}
			log.workflow.info(
				`Tool ${toolName} requires approval, setting awaiting approval with artifactType=${artifactType}`,
			);
			return this.setAwaitingApproval(workflowId, artifactType, artifactId);
		}

		// Check if this is an auto-transition tool
		const autoTargetStage = AUTO_TRANSITION_TOOLS[toolName];
		if (autoTargetStage) {
			return this.transitionStage(workflowId, autoTargetStage);
		}

		// Not a stage-completion tool
		return {
			transitioned: false,
			awaitingApproval: false,
		};
	}

	/**
	 * Set workflow to awaiting approval state
	 */
	private async setAwaitingApproval(
		workflowId: string,
		artifactType: ArtifactType,
		artifactId: string,
	): Promise<StageTransitionResult> {
		await this.workflowRepo.setAwaitingApproval(workflowId, artifactType);

		// Broadcast approval needed event
		log.workflow.info(
			`Broadcasting workflow:approval_needed for ${workflowId}, artifactType=${artifactType}, artifactId=${artifactId}`,
		);
		broadcast(
			createWorkflowApprovalNeededEvent({
				workflowId,
				artifactType,
				artifactId,
			}),
		);

		return {
			transitioned: false,
			awaitingApproval: true,
			artifactId,
		};
	}

	// ===========================================================================
	// User Approval Actions
	// ===========================================================================

	/**
	 * User approves pending artifact → transition to next stage
	 */
	async approveArtifact(workflowId: string): Promise<void> {
		const workflow = await this.workflowRepo.getById(workflowId);
		if (!workflow) {
			throw new Error(`Workflow not found: ${workflowId}`);
		}

		if (!workflow.awaitingApproval) {
			throw new Error(`Workflow ${workflowId} is not awaiting approval`);
		}

		// Update the artifact status to approved
		await this.updateLatestArtifactStatus(
			workflowId,
			workflow.pendingArtifactType,
			"approved",
		);

		// Get next stage
		const nextStage = STAGE_TRANSITIONS[workflow.status];
		if (!nextStage) {
			throw new Error(`No next stage for status: ${workflow.status}`);
		}

		// Clear approval state and transition
		await this.transitionStage(workflowId, nextStage);
	}

	/**
	 * User requests changes → agent continues in same stage
	 */
	async requestChanges(workflowId: string, feedback: string): Promise<void> {
		const workflow = await this.workflowRepo.getById(workflowId);
		if (!workflow) {
			throw new Error(`Workflow not found: ${workflowId}`);
		}

		if (!workflow.awaitingApproval) {
			throw new Error(`Workflow ${workflowId} is not awaiting approval`);
		}

		const sessionId = workflow.currentSessionId;
		if (!sessionId) {
			throw new Error(`Workflow ${workflowId} has no active session`);
		}

		// Update the artifact status to denied
		await this.updateLatestArtifactStatus(
			workflowId,
			workflow.pendingArtifactType,
			"denied",
		);

		// Clear awaiting approval state
		await this.workflowRepo.clearAwaitingApproval(workflowId);

		// Get the session and resume with feedback
		const session = await this.sessionManager.getOrRestoreSession(sessionId);
		if (!session || session.status !== "active") {
			log.workflow.error(
				`Cannot resume session ${sessionId} - not active (status: ${session?.status})`,
			);
			return;
		}

		// Format feedback as a user message
		const feedbackMessage = `**I've reviewed your scope card and have the following feedback:**\n\n${feedback}\n\nPlease revise the scope card based on this feedback and submit it again.`;

		// Create runner and resume
		const projectRoot = findRepoRoot(process.cwd());
		const runner = new AgentRunner(session, {
			projectRoot,
			conversationRepo: this.conversationRepo,
		});

		log.workflow.info(
			`Resuming session ${sessionId} with change request for workflow ${workflowId}`,
		);

		// Run in background (non-blocking)
		runner.run(feedbackMessage).catch((error) => {
			log.workflow.error(
				`Agent run failed after change request for workflow ${workflowId}:`,
				error,
			);
			this.sessionManager.errorSession(
				sessionId,
				error instanceof Error ? error.message : "Unknown error",
			);
		});
	}

	/**
	 * Update the status of the latest artifact of a given type
	 */
	private async updateLatestArtifactStatus(
		workflowId: string,
		artifactType: Workflow["pendingArtifactType"],
		status: "approved" | "denied",
	): Promise<void> {
		if (!artifactType) return;

		switch (artifactType) {
			case "scope_card": {
				const scopeCard =
					await this.artifactRepo.getLatestScopeCard(workflowId);
				if (scopeCard) {
					await this.artifactRepo.updateScopeCardStatus(scopeCard.id, status);
				}
				break;
			}
			case "research": {
				const researchCard =
					await this.artifactRepo.getLatestResearchCard(workflowId);
				if (researchCard) {
					await this.artifactRepo.updateResearchCardStatus(
						researchCard.id,
						status,
					);
				}
				break;
			}
			case "plan": {
				const plan = await this.artifactRepo.getLatestPlan(workflowId);
				if (plan) {
					await this.artifactRepo.updatePlanStatus(plan.id, status);
				}
				break;
			}
		}
	}

	// ===========================================================================
	// Stage Transitions
	// ===========================================================================

	/**
	 * Transition workflow to a new stage and spawn the appropriate agent
	 */
	private async transitionStage(
		workflowId: string,
		newStage: WorkflowStatus,
	): Promise<StageTransitionResult> {
		const workflow = await this.workflowRepo.getById(workflowId);
		if (!workflow) {
			throw new Error(`Workflow not found: ${workflowId}`);
		}

		const previousStage = workflow.status;

		// Stop current session if any
		if (workflow.currentSessionId) {
			await this.sessionManager.stopSession(workflow.currentSessionId);
		}

		// Check if workflow is complete
		if (newStage === "done") {
			await this.workflowRepo.transitionStage(workflowId, "done", null);

			broadcast(createWorkflowCompletedEvent({ workflowId }));

			return {
				transitioned: true,
				newStage: "done",
				awaitingApproval: false,
			};
		}

		// Start new agent session for the new stage
		const agentRole = this.getAgentForStage(newStage);
		const session = await this.sessionManager.startSession({
			contextType: "workflow",
			contextId: workflowId,
			agentRole,
		});

		// Update workflow
		await this.workflowRepo.transitionStage(workflowId, newStage, session.id);

		// Broadcast stage change event
		broadcast(
			createWorkflowStageChangedEvent({
				workflowId,
				previousStage,
				newStage,
				sessionId: session.id,
			}),
		);

		// Start the new agent with an appropriate initial message
		const initialMessage = await this.buildInitialMessage(
			workflowId,
			previousStage,
			newStage,
		);

		if (initialMessage) {
			const projectRoot = findRepoRoot(process.cwd());

			// For execution stage, include worktree path
			const worktreePath =
				newStage === "in_progress"
					? getWorktreePath(projectRoot, workflowId)
					: undefined;

			const runner = new AgentRunner(session, {
				projectRoot,
				conversationRepo: this.conversationRepo,
				worktreePath,
			});

			log.workflow.info(
				`Starting ${agentRole} agent for workflow ${workflowId}${worktreePath ? ` (worktree: ${worktreePath})` : ""}`,
			);

			// Run in background (non-blocking)
			// Mark as hidden so the transition message (with approved artifact) isn't shown in UI
			runner.run(initialMessage, { hidden: true }).catch((error) => {
				log.workflow.error(
					`Agent run failed for ${agentRole} in workflow ${workflowId}:`,
					error,
				);
				this.errorWorkflow(
					workflowId,
					error instanceof Error ? error.message : "Unknown error",
				);
			});
		}

		return {
			transitioned: true,
			newStage,
			awaitingApproval: false,
		};
	}

	/**
	 * Handle workflow error
	 */
	async errorWorkflow(workflowId: string, error: string): Promise<void> {
		const workflow = await this.workflowRepo.getById(workflowId);
		if (!workflow) {
			return;
		}

		// Stop current session
		if (workflow.currentSessionId) {
			await this.sessionManager.errorSession(workflow.currentSessionId, error);
		}

		// Broadcast error event
		broadcast(createWorkflowErrorEvent({ workflowId, error }));
	}

	// ===========================================================================
	// Preflight Handling
	// ===========================================================================

	/**
	 * Handle preflight completion
	 *
	 * Called when complete_preflight tool succeeds. Creates a new execution
	 * session and starts the first pulse.
	 */
	async handlePreflightCompletion(workflowId: string): Promise<void> {
		const workflow = await this.workflowRepo.getById(workflowId);
		if (!workflow) {
			log.workflow.error(`Workflow not found during preflight completion: ${workflowId}`);
			return;
		}

		// Stop preflight session
		if (workflow.currentSessionId) {
			await this.sessionManager.stopSession(workflow.currentSessionId);
		}

		const projectRoot = findRepoRoot(process.cwd());
		const worktreePath = getWorktreePath(projectRoot, workflowId);

		// Start the first pulse
		const firstPulse = await this.pulseOrchestrator.startNextPulse(
			workflowId,
			worktreePath,
		);

		if (!firstPulse) {
			log.workflow.error(`No pulses found for workflow ${workflowId} after preflight`);
			await this.errorWorkflow(workflowId, "No pulses found after preflight");
			return;
		}

		// Create fresh execution session for the first pulse
		const session = await this.sessionManager.startSession({
			contextType: "workflow",
			contextId: workflowId,
			agentRole: "execution",
		});

		// Update workflow with new session
		await this.workflowRepo.setCurrentSession(workflowId, session.id);

		// Build initial message for this pulse
		const initialMessage = await this.buildPulseInitialMessage(workflowId, firstPulse);

		const runner = new AgentRunner(session, {
			projectRoot,
			conversationRepo: this.conversationRepo,
			worktreePath,
		});

		log.workflow.info(
			`Starting execution agent for pulse ${firstPulse.id} in workflow ${workflowId}`,
		);

		// Run in background (non-blocking)
		runner.run(initialMessage, { hidden: true }).catch((error) => {
			log.workflow.error(
				`Execution agent failed for pulse ${firstPulse.id}:`,
				error,
			);
			this.errorWorkflow(
				workflowId,
				error instanceof Error ? error.message : "Unknown error",
			);
		});
	}

	// ===========================================================================
	// Pulse Handling
	// ===========================================================================

	/**
	 * Handle pulse completion
	 *
	 * Called when complete_pulse tool succeeds. Commits changes and either
	 * starts the next pulse (with fresh session) or transitions to review.
	 */
	async handlePulseCompletion(
		workflowId: string,
		commitMessage: string,
		hasUnresolvedIssues: boolean,
	): Promise<void> {
		const workflow = await this.workflowRepo.getById(workflowId);
		if (!workflow) {
			log.workflow.error(`Workflow not found during pulse completion: ${workflowId}`);
			return;
		}

		const pulse = await this.pulseOrchestrator.getRunningPulse(workflowId);
		if (!pulse) {
			log.workflow.error(
				`No running pulse found for workflow ${workflowId} during completion`,
			);
			return;
		}

		// Complete the pulse (commits, merges, etc.)
		const result = await this.pulseOrchestrator.completePulse(
			pulse.id,
			commitMessage,
			hasUnresolvedIssues,
		);

		if (!result.success) {
			log.workflow.error(`Failed to complete pulse: ${result.error}`);
			await this.errorWorkflow(
				workflowId,
				result.error ?? "Pulse completion failed",
			);
			return;
		}

		// If pulse has unresolved issues, halt for human review
		if (hasUnresolvedIssues) {
			log.workflow.info(
				`Pulse ${pulse.id} completed with unresolved issues - halting orchestration`,
			);
			// Don't start next pulse - wait for human intervention
			return;
		}

		// Check if there are more pulses
		if (result.hasMorePulses) {
			// Stop current session to clear context
			if (workflow.currentSessionId) {
				await this.sessionManager.stopSession(workflow.currentSessionId);
			}

			const projectRoot = findRepoRoot(process.cwd());
			const worktreePath = getWorktreePath(projectRoot, workflowId);

			// Start the next pulse
			const nextPulse = await this.pulseOrchestrator.startNextPulse(
				workflowId,
				worktreePath,
			);

			if (nextPulse) {
				// Create fresh session for next pulse (empty context)
				const session = await this.sessionManager.startSession({
					contextType: "workflow",
					contextId: workflowId,
					agentRole: "execution",
				});

				// Update workflow with new session
				await this.workflowRepo.setCurrentSession(workflowId, session.id);

				// Build initial message for this pulse
				const initialMessage = await this.buildPulseInitialMessage(workflowId, nextPulse);

				const runner = new AgentRunner(session, {
					projectRoot,
					conversationRepo: this.conversationRepo,
					worktreePath,
				});

				log.workflow.info(
					`Starting execution agent for pulse ${nextPulse.id} in workflow ${workflowId}`,
				);

				// Run in background (non-blocking)
				runner.run(initialMessage, { hidden: true }).catch((error) => {
					log.workflow.error(
						`Execution agent failed for pulse ${nextPulse.id}:`,
						error,
					);
					this.errorWorkflow(
						workflowId,
						error instanceof Error ? error.message : "Unknown error",
					);
				});
			}
		} else {
			// All pulses complete - transition to review
			log.workflow.info(
				`All pulses complete for workflow ${workflowId} - transitioning to review`,
			);
			await this.transitionStage(workflowId, "review");
		}
	}

	/**
	 * Handle pulse failure
	 */
	async handlePulseFailure(workflowId: string, reason: string): Promise<void> {
		const pulse = await this.pulseOrchestrator.getRunningPulse(workflowId);
		if (pulse) {
			await this.pulseOrchestrator.failPulse(pulse.id, reason);
		}
		// Don't transition - wait for human intervention
	}

	/**
	 * Get the pulse orchestrator (for external access)
	 */
	getPulseOrchestrator(): PulseOrchestrator {
		return this.pulseOrchestrator;
	}

	// ===========================================================================
	// Helpers
	// ===========================================================================

	/**
	 * Build the initial message for a new stage's agent based on the approved artifact
	 */
	private async buildInitialMessage(
		workflowId: string,
		previousStage: WorkflowStatus,
		newStage: WorkflowStatus,
	): Promise<string | null> {
		// Scoping -> Research: send the approved scope card
		if (previousStage === "scoping" && newStage === "researching") {
			const scopeCard = await this.artifactRepo.getLatestScopeCard(workflowId);

			if (!scopeCard) {
				log.workflow.error(
					`No scope card found for workflow ${workflowId} when transitioning to research`,
				);
				return null;
			}

			let message = `## Approved Scope Card

The following scope has been approved for this task. Please begin your research phase.

### Title
${scopeCard.title}

### Description
${scopeCard.description}

### In Scope
${scopeCard.inScope.map((item) => `- ${item}`).join("\n")}

### Out of Scope
${scopeCard.outOfScope.map((item) => `- ${item}`).join("\n")}`;

			if (scopeCard.constraints && scopeCard.constraints.length > 0) {
				message += `\n\n### Constraints\n${scopeCard.constraints.map((item) => `- ${item}`).join("\n")}`;
			}

			if (scopeCard.rationale) {
				message += `\n\n### Rationale\n${scopeCard.rationale}`;
			}

			message +=
				"\n\nPlease analyze the codebase to understand the relevant architecture, patterns, and integration points needed to implement this scope.";

			return message;
		}

		// Research -> Planning: send BOTH scope card AND research findings
		if (previousStage === "researching" && newStage === "planning") {
			const scopeCard = await this.artifactRepo.getLatestScopeCard(workflowId);
			const researchCard =
				await this.artifactRepo.getLatestResearchCard(workflowId);

			if (!scopeCard) {
				log.workflow.error(
					`No scope card found for workflow ${workflowId} when transitioning to planning`,
				);
				return null;
			}

			if (!researchCard) {
				log.workflow.error(
					`No research card found for workflow ${workflowId} when transitioning to planning`,
				);
				return null;
			}

			// Build message with BOTH scope and research context
			let message = `## Approved Scope

The following scope has been approved for this task.

### Title
${scopeCard.title}

### Description
${scopeCard.description}

### In Scope
${scopeCard.inScope.map((item) => `- ${item}`).join("\n")}

### Out of Scope
${scopeCard.outOfScope.map((item) => `- ${item}`).join("\n")}`;

			if (scopeCard.constraints && scopeCard.constraints.length > 0) {
				message += `\n\n### Constraints\n${scopeCard.constraints.map((item) => `- ${item}`).join("\n")}`;
			}

			message += `\n\n---\n\n## Approved Research Findings

The following research has been approved.

### Summary
${researchCard.summary}

### Key Files
${researchCard.keyFiles.map((f) => `- \`${f.path}\`: ${f.purpose}`).join("\n")}

### Recommendations
${researchCard.recommendations.map((r) => `- ${r}`).join("\n")}`;

			if (researchCard.patterns && researchCard.patterns.length > 0) {
				message += `\n\n### Patterns Identified\n${researchCard.patterns.map((p) => `- **${p.category}**: ${p.description}`).join("\n")}`;
			}

			if (
				researchCard.integrationPoints &&
				researchCard.integrationPoints.length > 0
			) {
				message += `\n\n### Integration Points\n${researchCard.integrationPoints.map((ip) => `- \`${ip.location}\`: ${ip.description}`).join("\n")}`;
			}

			if (researchCard.challenges && researchCard.challenges.length > 0) {
				message += `\n\n### Potential Challenges\n${researchCard.challenges.map((c) => `- **${c.issue}**: ${c.mitigation}`).join("\n")}`;
			}

			message +=
				"\n\nPlease create a detailed implementation plan based on this scope and research. Break the work into discrete pulses ordered by dependencies.";

			return message;
		}

		// Planning -> in_progress: initialize pulsing and start preflight agent
		if (previousStage === "planning" && newStage === "in_progress") {
			const plan = await this.artifactRepo.getLatestPlan(workflowId);

			if (!plan) {
				log.workflow.error(
					`No plan found for workflow ${workflowId} when transitioning to execution`,
				);
				return null;
			}

			// Initialize pulsing (create worktree and branch)
			const pulsingResult =
				await this.pulseOrchestrator.initializePulsing(workflowId);
			if (!pulsingResult.success) {
				log.workflow.error(
					`Failed to initialize pulsing: ${pulsingResult.error}`,
				);
				return null;
			}

			// Create pulses from the plan
			await this.pulseOrchestrator.createPulsesFromPlan(
				workflowId,
				plan.pulses,
			);

			// Create preflight setup record
			const workflow = await this.workflowRepo.getById(workflowId);
			if (workflow?.currentSessionId) {
				await this.pulseOrchestrator.createPreflightSetup(
					workflowId,
					workflow.currentSessionId,
				);
			}

			// Build the initial message for the PREFLIGHT agent
			const message = `## Preflight Environment Setup

You are preparing the development environment in an isolated worktree before code execution begins.

**Worktree Path:** \`${pulsingResult.worktreePath}\`

### Plan Overview

**Approach:** ${plan.approachSummary}

**Pulses to Execute:** ${plan.pulses.length}
${plan.pulses.map((p) => `- ${p.id}: ${p.title}`).join("\n")}

### Your Task

1. Initialize the development environment (restore dependencies, build, etc.)
2. Record any pre-existing build errors/warnings as baselines using \`record_baseline\`
3. When the environment is ready, call \`complete_preflight\` with a summary

Do NOT modify any tracked files. Only initialize dependencies and build artifacts.`;

			return message;
		}

		// For other transitions, return null (no automatic message)
		return null;
	}

	/**
	 * Build the initial message for a pulse execution.
	 * Provides context without conversation history (fresh session per pulse).
	 */
	private async buildPulseInitialMessage(
		workflowId: string,
		pulse: Pulse,
	): Promise<string> {
		// Get artifacts for context
		const scopeCard = await this.artifactRepo.getLatestScopeCard(workflowId);
		const researchCard = await this.artifactRepo.getLatestResearchCard(workflowId);
		const plan = await this.artifactRepo.getLatestPlan(workflowId);

		// Find the pulse definition from the plan for more details
		const pulseDef = plan?.pulses.find((p) => p.id === pulse.id);

		let message = `## Current Pulse: ${pulse.id}

${pulse.description}`;

		if (pulseDef) {
			message += `

**Expected Changes:** ${pulseDef.expectedChanges.map((f) => `\`${f}\``).join(", ")}
**Estimated Size:** ${pulseDef.estimatedSize}`;
			if (pulseDef.dependsOn && pulseDef.dependsOn.length > 0) {
				message += `
**Depends On:** ${pulseDef.dependsOn.join(", ")} (already completed)`;
			}
		}

		message += `

---

## Context (for reference)`;

		// Add scope summary
		if (scopeCard) {
			message += `

### Scope: ${scopeCard.title}
${scopeCard.description}

**In Scope:** ${scopeCard.inScope.slice(0, 3).join("; ")}${scopeCard.inScope.length > 3 ? "..." : ""}`;
		}

		// Add research recommendations
		if (researchCard) {
			message += `

### Research Recommendations
${researchCard.recommendations.map((r) => `- ${r}`).join("\n")}`;

			if (researchCard.keyFiles.length > 0) {
				const relevantFiles = researchCard.keyFiles.slice(0, 5);
				message += `

### Key Files
${relevantFiles.map((f) => `- \`${f.path}\`: ${f.purpose}`).join("\n")}`;
			}
		}

		// Add plan approach
		if (plan) {
			message += `

### Plan Approach
${plan.approachSummary}`;
		}

		message += `

---

Execute this pulse. When complete, call \`complete_pulse\` with a commit message. If you need more time, use \`request_extension\`.`;

		return message;
	}

	/**
	 * Get agent role for a workflow stage
	 */
	private getAgentForStage(stage: WorkflowStatus): ModelScenario {
		return STAGE_TO_AGENT[stage];
	}

	/**
	 * Get workflow by ID
	 */
	async getWorkflow(workflowId: string): Promise<Workflow | null> {
		return this.workflowRepo.getById(workflowId);
	}
}

// =============================================================================
// Singleton Instance
// =============================================================================

let orchestratorInstance: WorkflowOrchestrator | null = null;

/**
 * Get the singleton WorkflowOrchestrator instance
 */
export function getWorkflowOrchestrator(): WorkflowOrchestrator {
	if (!orchestratorInstance) {
		throw new Error(
			"WorkflowOrchestrator not initialized. Call initWorkflowOrchestrator first.",
		);
	}
	return orchestratorInstance;
}

/**
 * Initialize the singleton WorkflowOrchestrator instance
 */
export function initWorkflowOrchestrator(
	sessionManager: SessionManager,
	workflowRepo: WorkflowRepository,
	artifactRepo: ArtifactRepository,
	conversationRepo: ConversationRepository,
	pulseRepo: PulseRepository,
): WorkflowOrchestrator {
	orchestratorInstance = new WorkflowOrchestrator(
		sessionManager,
		workflowRepo,
		artifactRepo,
		conversationRepo,
		pulseRepo,
	);
	return orchestratorInstance;
}
