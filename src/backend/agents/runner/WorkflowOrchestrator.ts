/**
 * WorkflowOrchestrator - Manages workflow lifecycle and stage transitions
 *
 * Handles:
 * - Creating new workflows
 * - Processing stage-completion tools (scope_card_submit, plan_submit, etc.)
 * - Managing approval gates (most transitions require user approval)
 * - Spawning appropriate agents for each stage
 */

import { generateObject } from "ai";
import { z } from "zod";
import {
	checkoutInWorktree,
	cleanupWorkflow,
	findRepoRoot,
	getCurrentBranch,
	getWorktreePath,
	mergeWorkflowBranch,
} from "@/backend/git";
import { getModelForScenario } from "@/backend/llm/models";
import { log } from "@/backend/logger";
import {
	type ArtifactRepository,
	type ConversationRepository,
	getRepositories,
	type Pulse,
	type PulseRepository,
	type WorkflowRepository,
} from "@/backend/repositories";
import { PulseOrchestrator } from "@/backend/services/pulsing";
import { shellApprovalService } from "@/backend/services/shell-approval";
import { ids } from "@/backend/utils";
import { broadcast } from "@/backend/ws";
import {
	createWorkflowApprovalNeededEvent,
	createWorkflowCompletedEvent,
	createWorkflowCreatedEvent,
	createWorkflowErrorEvent,
	createWorkflowStageChangedEvent,
} from "@/shared/schemas/events";
import type {
	MergeStrategy,
	RewindTarget,
	WorkflowStatus,
} from "@/shared/schemas/workflow";
import {
	APPROVAL_REQUIRED_TOOLS,
	AUTO_TRANSITION_TOOLS,
	STAGE_TRANSITIONS,
	type Workflow,
} from "@/shared/schemas/workflow";
import { AgentRunner } from "./AgentRunner";
import type { SessionManager } from "./SessionManager";
import type { AgentRole, ArtifactType, StageTransitionResult } from "./types";

// =============================================================================
// Constants
// =============================================================================

/** Maps workflow status to agent role */
const STAGE_TO_AGENT: Record<WorkflowStatus, AgentRole> = {
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
	complete_review: "review_card",
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
			workflowRepo: this.workflowRepo,
		});
	}

	// ===========================================================================
	// Workflow Creation
	// ===========================================================================

	/**
	 * Create a new workflow and start the scoping agent
	 *
	 * @param prompt - The user's initial message describing the task
	 * @param priority - Workflow priority level
	 */
	async createWorkflow(
		prompt: string,
		priority: "low" | "medium" | "high" | "urgent" = "medium",
	): Promise<Workflow> {
		// Generate title and description from the user's prompt using LLM
		const { title, description } =
			await this.generateTitleAndDescription(prompt);

		// Create workflow using repository with generated metadata
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

		// Use the raw prompt as the initial prompt for the scoping agent
		const initialPrompt = prompt;

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
	 *
	 * NOTE: complete_preflight and complete_pulse are NOT handled here.
	 * Those transitions are deferred to handleTurnCompletion() which is called
	 * after the agent turn finishes, avoiding abort errors from killing the session
	 * mid-stream.
	 */
	async handleToolResult(
		workflowId: string,
		toolName: string,
		artifactId: string,
	): Promise<StageTransitionResult> {
		log.workflow.info(
			`handleToolResult: workflowId=${workflowId}, toolName=${toolName}, artifactId=${artifactId}`,
		);

		// NOTE: complete_preflight and complete_pulse are intentionally NOT handled here.
		// They are handled in handleTurnCompletion() after the turn finishes to avoid
		// aborting the stream mid-execution.

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
	 * Handle turn completion - check for deferred auto-transitions
	 *
	 * Called by AgentRunner after a turn completes successfully.
	 * This handles transitions that need to happen AFTER the turn ends
	 * (like complete_preflight and complete_pulse) to avoid aborting mid-stream.
	 */
	async handleTurnCompletion(
		workflowId: string,
		toolNames: string[],
	): Promise<void> {
		// Check if complete_preflight was called
		if (toolNames.includes("complete_preflight")) {
			log.workflow.info(
				`Turn completed with complete_preflight - starting first pulse for workflow ${workflowId}`,
			);
			await this.handlePreflightCompletion(workflowId);
			return;
		}

		// Check if complete_pulse was called
		// Note: complete_pulse stores its data in the tool execution,
		// but we need to check the DB for the pending pulse completion
		if (toolNames.includes("complete_pulse")) {
			log.workflow.info(
				`Turn completed with complete_pulse - handling pulse transition for workflow ${workflowId}`,
			);
			// The pulse completion data (commit message, unresolved issues) was already
			// saved by the tool. We just need to trigger the next pulse or review transition.
			await this.handleDeferredPulseCompletion(workflowId);
		}
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
	 * @param options - Optional options for the approval
	 * @param options.path - Path to take ('quick' skips research/planning, 'full' follows normal flow)
	 * @param options.mergeStrategy - Merge strategy for review stage approvals
	 * @param options.commitMessage - Commit message for review stage approvals
	 */
	async approveArtifact(
		workflowId: string,
		options?: {
			path?: "quick" | "full";
			mergeStrategy?: MergeStrategy;
			commitMessage?: string;
		},
	): Promise<void> {
		const workflow = await this.workflowRepo.getById(workflowId);
		if (!workflow) {
			throw new Error(`Workflow not found: ${workflowId}`);
		}

		if (!workflow.awaitingApproval) {
			throw new Error(`Workflow ${workflowId} is not awaiting approval`);
		}

		// Handle merge and cleanup for review stage approvals
		if (
			options?.mergeStrategy &&
			options?.commitMessage &&
			workflow.pendingArtifactType === "review_card"
		) {
			const baseBranch = workflow.baseBranch;
			if (!baseBranch) {
				throw new Error(
					`Workflow ${workflowId} has no base branch recorded - cannot merge`,
				);
			}

			const workflowBranch = `autarch/${workflowId}`;
			const projectRoot = findRepoRoot(process.cwd());
			const worktreePath = getWorktreePath(projectRoot, workflowId);

			// Build trailers for workflow provenance
			const trailers: Record<string, string> = {
				"Autarch-Workflow-Id": workflowId,
			};
			if (workflow.title?.trim()) {
				// Convert title to lowercase-hyphenated slug (matching PulseOrchestrator format)
				const slug = workflow.title
					.toLowerCase()
					.replace(/[^a-z0-9]+/g, "-")
					.replace(/^-|-$/g, "");
				trailers["Autarch-Workflow-Name"] = slug;
			}

			try {
				// Merge workflow branch into base branch
				await mergeWorkflowBranch(
					projectRoot,
					worktreePath,
					baseBranch,
					workflowBranch,
					options.mergeStrategy,
					options.commitMessage,
					trailers,
				);

				log.workflow.info(
					`Merged workflow ${workflowId} into ${baseBranch} using ${options.mergeStrategy} strategy`,
				);

				// Cleanup worktree and delete workflow branch
				await cleanupWorkflow(projectRoot, workflowId, { deleteBranch: true });
				log.workflow.info(
					`Cleaned up workflow ${workflowId} after successful merge`,
				);
			} catch (error) {
				const errorMessage =
					error instanceof Error ? error.message : String(error);
				log.workflow.error(
					`Merge failed for workflow ${workflowId}: ${errorMessage}`,
				);

				// Attempt to restore worktree to workflow branch to leave it in a consistent state
				try {
					await checkoutInWorktree(worktreePath, workflowBranch);
					log.workflow.info(
						`Restored worktree to ${workflowBranch} after merge failure`,
					);
				} catch (restoreError) {
					// Log but don't throw - the original error is more important
					log.workflow.error(
						`Failed to restore worktree to ${workflowBranch}: ${restoreError instanceof Error ? restoreError.message : String(restoreError)}`,
					);
				}

				// Do NOT call transitionStage - workflow stays in review
				throw new Error(
					`Failed to merge workflow branch into ${baseBranch}: ${errorMessage}`,
				);
			}
		}

		// Update the artifact status to approved
		await this.updateLatestArtifactStatus(
			workflowId,
			workflow.pendingArtifactType,
			"approved",
		);

		// Handle scoping stage with path selection (quick vs full)
		if (workflow.status === "scoping") {
			const scopeCard = await this.artifactRepo.getLatestScopeCard(workflowId);
			if (!scopeCard) {
				throw new Error(
					`No scope card found for workflow ${workflowId} when approving`,
				);
			}

			const effectivePath = options?.path || scopeCard.recommendedPath;

			if (effectivePath === "quick") {
				// Quick path: skip research and planning, go directly to execution
				await this.executeQuickPath(workflowId, scopeCard);
				return;
			}
			// Full path: continue with normal STAGE_TRANSITIONS flow
		}

		// Get next stage
		const nextStage = STAGE_TRANSITIONS[workflow.status];
		if (!nextStage) {
			throw new Error(`No next stage for status: ${workflow.status}`);
		}

		// Clear approval state and transition
		await this.transitionStage(workflowId, nextStage);
	}

	/**
	 * Execute quick path: skip research/planning and go directly to execution
	 * Creates a single pulse from the scope card and starts preflight
	 */
	private async executeQuickPath(
		workflowId: string,
		scopeCard: {
			title: string;
			description: string;
			inScope: string[];
			outOfScope: string[];
			constraints?: string[];
			rationale?: string;
		},
	): Promise<void> {
		const projectRoot = findRepoRoot(process.cwd());

		// Capture base branch before pulsing initialization
		const baseBranch = await getCurrentBranch(projectRoot);
		await this.workflowRepo.setBaseBranch(workflowId, baseBranch);
		log.workflow.info(
			`[Quick Path] Captured base branch '${baseBranch}' for workflow ${workflowId}`,
		);

		// Initialize pulsing (create worktree and branch)
		const pulsingResult =
			await this.pulseOrchestrator.initializePulsing(workflowId);
		if (!pulsingResult.success) {
			log.workflow.error(
				`[Quick Path] Failed to initialize pulsing: ${pulsingResult.error}`,
			);
			throw new Error(`Failed to initialize pulsing: ${pulsingResult.error}`);
		}

		// Build pulse description with full scope card context (same format as buildInitialMessage)
		let pulseDescription = `### Title
${scopeCard.title}

### Description
${scopeCard.description}

### In Scope
${scopeCard.inScope.map((item) => `- ${item}`).join("\n")}

### Out of Scope
${scopeCard.outOfScope.map((item) => `- ${item}`).join("\n")}`;

		if (scopeCard.constraints && scopeCard.constraints.length > 0) {
			pulseDescription += `\n\n### Constraints\n${scopeCard.constraints.map((item) => `- ${item}`).join("\n")}`;
		}

		if (scopeCard.rationale) {
			pulseDescription += `\n\n### Rationale\n${scopeCard.rationale}`;
		}

		// Create single pulse with full scope card as description
		const singlePulse = {
			id: ids.pulse(),
			title: scopeCard.title,
			description: pulseDescription,
		};

		await this.pulseOrchestrator.createPulsesFromPlan(workflowId, [
			singlePulse,
		]);
		log.workflow.info(
			`[Quick Path] Created single pulse ${singlePulse.id} for workflow ${workflowId}`,
		);

		// Mark skipped stages
		await this.workflowRepo.setSkippedStages(workflowId, [
			"researching",
			"planning",
		]);
		log.workflow.info(
			`[Quick Path] Marked stages as skipped for workflow ${workflowId}`,
		);

		// Get workflow to access current session (for preflight agent)
		const workflow = await this.workflowRepo.getById(workflowId);
		if (!workflow) {
			throw new Error(`Workflow not found: ${workflowId}`);
		}

		// Stop current session if any
		if (workflow.currentSessionId) {
			await this.sessionManager.stopSession(workflow.currentSessionId);
		}

		// Start preflight agent session (same as planning→in_progress transition)
		const agentRole = this.getAgentForStage("in_progress");
		const session = await this.sessionManager.startSession({
			contextType: "workflow",
			contextId: workflowId,
			agentRole,
		});

		// Update workflow to in_progress
		await this.workflowRepo.transitionStage(
			workflowId,
			"in_progress",
			session.id,
		);

		// Create preflight setup record
		await this.pulseOrchestrator.createPreflightSetup(workflowId, session.id);

		// Broadcast stage change event
		broadcast(
			createWorkflowStageChangedEvent({
				workflowId,
				previousStage: "scoping",
				newStage: "in_progress",
				sessionId: session.id,
			}),
		);

		// Build preflight agent message
		const preflightMessage = `## Preflight Environment Setup

You are preparing the development environment in an isolated worktree before code execution begins.

**Worktree Path:** \`${pulsingResult.worktreePath}\`

### Quick Path Execution

This workflow is taking the quick path (skipping research and planning stages).

**Pulse to Execute:** 1
- ${singlePulse.id}: ${singlePulse.title}

Please install dependencies, verify the build succeeds, and run the linter to establish a baseline for the execution phase.`;

		// Run preflight agent
		const runner = new AgentRunner(session, {
			projectRoot,
			conversationRepo: this.conversationRepo,
			worktreePath: pulsingResult.worktreePath,
		});

		log.workflow.info(
			`[Quick Path] Starting preflight agent for workflow ${workflowId} (worktree: ${pulsingResult.worktreePath})`,
		);

		// Run in background (non-blocking)
		runner.run(preflightMessage, { hidden: true }).catch((error) => {
			log.workflow.error(
				`[Quick Path] Preflight agent run failed for workflow ${workflowId}:`,
				error,
			);
			this.errorWorkflow(
				workflowId,
				error instanceof Error ? error.message : "Unknown error",
			);
		});
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
	 * User requests fixes for selected review comments → creates fix pulse and restarts execution
	 *
	 * @param workflowId - The workflow to request fixes for
	 * @param commentIds - IDs of comments to address in the fix pulse
	 * @param summary - Optional summary from user describing the fixes
	 */
	async requestFixes(
		workflowId: string,
		commentIds: string[],
		summary?: string,
	): Promise<void> {
		const workflow = await this.workflowRepo.getById(workflowId);
		if (!workflow) {
			throw new Error(`Workflow not found: ${workflowId}`);
		}

		if (workflow.status !== "review") {
			throw new Error(
				`Workflow ${workflowId} is not in review stage (current: ${workflow.status})`,
			);
		}

		if (!workflow.awaitingApproval) {
			throw new Error(
				`Workflow ${workflowId} is not awaiting approval - review may not be complete`,
			);
		}

		// Fetch the selected comments
		const comments = await this.artifactRepo.getCommentsByIds(commentIds);
		if (comments.length === 0) {
			throw new Error("No valid comments found for the provided IDs");
		}

		// Format the fix description from comments
		let fixDescription = "## Fix Request\n\n";

		fixDescription += "### Comments to Address\n\n";

		for (const comment of comments) {
			fixDescription += `#### ${comment.type === "line" ? `Line Comment` : comment.type === "file" ? `File Comment` : `Review Comment`}`;
			if (comment.filePath) {
				fixDescription += ` - \`${comment.filePath}\``;
				if (comment.startLine) {
					fixDescription += `:${comment.startLine}`;
					if (comment.endLine && comment.endLine !== comment.startLine) {
						fixDescription += `-${comment.endLine}`;
					}
				}
			}
			fixDescription += "\n";

			if (comment.severity) {
				fixDescription += `**Severity:** ${comment.severity}\n`;
			}
			if (comment.category) {
				fixDescription += `**Category:** ${comment.category}\n`;
			}
			fixDescription += `**Author:** ${comment.author}\n`;
			fixDescription += `\n${comment.description}\n\n`;
		}

		if (summary) {
			fixDescription += `### Comments from Human Reviewer:\n${summary}\n\n`;
		}

		fixDescription +=
			'---\n\nNote: The fixes above have been **explicitly requested by the user**. Apply them, regardless of whether they\'re described as "required", "optional", or "nice to have".\n';

		// Stop current session if any
		if (workflow.currentSessionId) {
			await this.sessionManager.stopSession(workflow.currentSessionId);
		}

		// Create an ad-hoc fix pulse (no plannedPulseId)
		const fixPulse = await this.pulseRepo.createPulse({
			workflowId,
			description: fixDescription,
		});

		log.workflow.info(
			`Created fix pulse ${fixPulse.id} for workflow ${workflowId} with ${comments.length} comments`,
		);

		// Start the fix pulse first, before transitioning stage
		// This ensures we don't leave the workflow in an inconsistent state if pulse creation fails
		const projectRoot = findRepoRoot(process.cwd());
		const worktreePath = getWorktreePath(projectRoot, workflowId);

		const startedPulse = await this.pulseOrchestrator.startNextPulse(
			workflowId,
			worktreePath,
		);

		if (!startedPulse) {
			log.workflow.error(
				`Failed to start fix pulse for workflow ${workflowId}`,
			);
			throw new Error("Failed to start fix pulse");
		}

		// Transition to in_progress stage after confirming pulse started
		await this.workflowRepo.transitionStage(workflowId, "in_progress", null);

		// Create fresh execution session for the fix pulse
		const session = await this.sessionManager.startSession({
			contextType: "workflow",
			contextId: workflowId,
			agentRole: "execution",
		});

		// Update workflow with new session
		await this.workflowRepo.setCurrentSession(workflowId, session.id);

		// Build initial message for the fix pulse
		const initialMessage = await this.buildPulseInitialMessage(
			workflowId,
			startedPulse,
		);

		const runner = new AgentRunner(session, {
			projectRoot,
			conversationRepo: this.conversationRepo,
			worktreePath,
		});

		log.workflow.info(
			`Starting execution agent for fix pulse ${startedPulse.id} in workflow ${workflowId}`,
		);

		// Broadcast stage change event
		broadcast(
			createWorkflowStageChangedEvent({
				workflowId,
				previousStage: "review",
				newStage: "in_progress",
				sessionId: session.id,
			}),
		);

		// Run in background (non-blocking)
		runner.run(initialMessage, { hidden: true }).catch((error) => {
			log.workflow.error(
				`Execution agent failed for fix pulse ${startedPulse.id}:`,
				error,
			);
			this.errorWorkflow(
				workflowId,
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
			case "review_card": {
				const reviewCard =
					await this.artifactRepo.getLatestReviewCard(workflowId);
				if (reviewCard) {
					await this.artifactRepo.updateReviewCardStatus(reviewCard.id, status);
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

			// Clean up remembered shell commands for this workflow
			shellApprovalService.cleanupWorkflow(workflowId);

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

		// Create review card when entering review stage (so comments can reference it immediately)
		if (newStage === "review") {
			await this.artifactRepo.createReviewCard({ workflowId });
			log.workflow.info(`Created review card for workflow ${workflowId}`);
		}

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
				newStage === "in_progress" || newStage === "review"
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
	 * Called AFTER the turn completes (via handleTurnCompletion).
	 * Creates a new execution session and starts the first pulse.
	 */
	async handlePreflightCompletion(workflowId: string): Promise<void> {
		const workflow = await this.workflowRepo.getById(workflowId);
		if (!workflow) {
			log.workflow.error(
				`Workflow not found during preflight completion: ${workflowId}`,
			);
			return;
		}

		// Stop the preflight session - safe now since the turn is complete
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
			log.workflow.error(
				`No pulses found for workflow ${workflowId} after preflight`,
			);
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
		const initialMessage = await this.buildPulseInitialMessage(
			workflowId,
			firstPulse,
		);

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
			log.workflow.error(
				`Workflow not found during pulse completion: ${workflowId}`,
			);
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
			// Stop current session - safe now since the turn is complete
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
				const initialMessage = await this.buildPulseInitialMessage(
					workflowId,
					nextPulse,
				);

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
	 * Handle deferred pulse completion (session transition only)
	 *
	 * Called AFTER the turn completes (via handleTurnCompletion).
	 * The git commit/merge was already done by the complete_pulse tool.
	 * This just handles the session transition to the next pulse or review.
	 */
	private async handleDeferredPulseCompletion(
		workflowId: string,
	): Promise<void> {
		const workflow = await this.workflowRepo.getById(workflowId);
		if (!workflow) {
			log.workflow.error(
				`Workflow not found during deferred pulse completion: ${workflowId}`,
			);
			return;
		}

		// Get all pulses to determine state
		const pulses = await this.pulseRepo.getPulsesForWorkflow(workflowId);

		// Find the most recently completed pulse
		const completedPulse = pulses
			.filter((p) => p.status === "succeeded")
			.sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0))[0];

		if (!completedPulse) {
			log.workflow.error(`No completed pulse found for workflow ${workflowId}`);
			return;
		}

		// If pulse had unresolved issues, halt for human review
		if (completedPulse.hasUnresolvedIssues) {
			log.workflow.info(
				`Pulse ${completedPulse.id} completed with unresolved issues - halting orchestration`,
			);
			return;
		}

		// Check if there are more pulses (any proposed pulses remaining)
		const hasMorePulses = pulses.some((p) => p.status === "proposed");

		if (hasMorePulses) {
			// Stop current session - safe now since the turn is complete
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
				const initialMessage = await this.buildPulseInitialMessage(
					workflowId,
					nextPulse,
				);

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

			// Capture base branch before pulsing initialization
			const projectRoot = findRepoRoot(process.cwd());
			const baseBranch = await getCurrentBranch(projectRoot);
			await this.workflowRepo.setBaseBranch(workflowId, baseBranch);
			log.workflow.info(
				`Captured base branch '${baseBranch}' for workflow ${workflowId}`,
			);

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

		// in_progress -> review: send ONLY scope title and description
		if (previousStage === "in_progress" && newStage === "review") {
			const scopeCard = await this.artifactRepo.getLatestScopeCard(workflowId);

			if (!scopeCard) {
				log.workflow.error(
					`No scope card found for workflow ${workflowId} when transitioning to review`,
				);
				return null;
			}

			const message = `## Scope for Review

### ${scopeCard.title}

${scopeCard.description}

---

Please review the changes made for this scope. Use the available tools to:
1. Get the diff of all changes using \`get_diff\`
2. Add comments at the line, file, or review level as needed
3. Complete your review with a recommendation (approve, deny, or manual_review)`;

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
		const researchCard =
			await this.artifactRepo.getLatestResearchCard(workflowId);
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
	private getAgentForStage(stage: WorkflowStatus): AgentRole {
		return STAGE_TO_AGENT[stage];
	}

	/**
	 * Generate a title and description from a user prompt using LLM.
	 *
	 * @param prompt - The user's initial message/prompt
	 * @returns Generated title (lowercase-hyphenated slug) and description
	 * @throws Error with user-friendly message if generation fails
	 */
	private async generateTitleAndDescription(
		prompt: string,
	): Promise<{ title: string; description: string }> {
		try {
			const { model } = await getModelForScenario("basic");

			const { object } = await generateObject({
				model,
				schema: z.object({
					title: z
						.string()
						.describe(
							"A lowercase hyphenated slug title like 'add-user-auth-oauth' or 'fix-navbar-alignment'. Should be concise (2-5 words).",
						),
					description: z
						.string()
						.describe(
							"A brief one-sentence description of the task that captures the main objective.",
						),
				}),
				system:
					"You are a helpful assistant that generates concise workflow titles and descriptions from user prompts. " +
					"The title should be a lowercase hyphenated slug suitable for use as an identifier (e.g., 'add-user-auth-oauth', 'fix-navbar-alignment', 'update-api-endpoints'). " +
					"The description should be a single sentence that clearly explains what the task aims to accomplish.",
				prompt: `Generate a title and description for the following task:\n\n${prompt}`,
			});

			return object;
		} catch (error) {
			log.workflow.error(
				"Failed to generate workflow title and description:",
				error,
			);
			throw new Error(
				"Failed to generate workflow title. Please check your API key configuration and try again.",
			);
		}
	}

	/**
	 * Get workflow by ID
	 */
	async getWorkflow(workflowId: string): Promise<Workflow | null> {
		return this.workflowRepo.getById(workflowId);
	}

	// ===========================================================================
	// Rewind Operations
	// ===========================================================================

	/**
	 * Rewind a workflow to a specific stage
	 *
	 * Cleans up all artifacts and state from stages after the target,
	 * then restarts the workflow at the target stage.
	 *
	 * @param workflowId - The workflow to rewind
	 * @param targetStage - The stage to rewind to
	 */
	async rewindToStage(
		workflowId: string,
		targetStage: RewindTarget,
	): Promise<void> {
		const workflow = await this.workflowRepo.getById(workflowId);
		if (!workflow) {
			throw new Error(`Workflow not found: ${workflowId}`);
		}

		log.workflow.info(
			`Rewinding workflow ${workflowId} to ${targetStage} stage`,
		);

		// 1. Stop current session if active
		if (workflow.currentSessionId) {
			await this.sessionManager.stopSession(workflow.currentSessionId);
		}

		// Review rewind is special - no git/pulse cleanup needed (keep execution results)
		if (targetStage === "review") {
			const projectRoot = findRepoRoot(process.cwd());
			await this.rewindToReviewImpl(workflowId, projectRoot);
			return;
		}

		// 2. Cleanup git worktree and branch (needed for non-review rewinds)
		const projectRoot = findRepoRoot(process.cwd());
		try {
			await cleanupWorkflow(projectRoot, workflowId, { deleteBranch: true });
		} catch (error) {
			log.workflow.warn(
				`Git cleanup failed (may not exist yet): ${error instanceof Error ? error.message : "unknown"}`,
			);
		}

		// 3. Delete pulse-related data (needed for non-review rewinds)
		await this.pulseRepo.deleteBaselines(workflowId);
		await this.pulseRepo.deleteCommandBaselines(workflowId);
		await this.pulseRepo.deletePreflightSetup(workflowId);
		await this.pulseRepo.deleteByWorkflow(workflowId);

		// Route to appropriate rewind handler
		if (targetStage === "researching") {
			await this.rewindToResearchingImpl(workflowId, projectRoot);
		} else if (targetStage === "planning") {
			await this.rewindToPlanningImpl(workflowId, projectRoot);
		} else if (targetStage === "in_progress") {
			await this.rewindToExecutionImpl(workflowId, projectRoot);
		}
	}

	/**
	 * Implementation for rewinding to researching stage
	 */
	private async rewindToResearchingImpl(
		workflowId: string,
		projectRoot: string,
	): Promise<void> {
		const repos = getRepositories();

		// Delete all artifacts after scope: research cards, plans, review cards
		await this.artifactRepo.deleteResearchCardsByWorkflow(workflowId);
		await this.artifactRepo.deletePlansByWorkflow(workflowId);
		await this.artifactRepo.deleteReviewCardsByWorkflow(workflowId);

		// Delete all sessions after scoping
		const deletedCount = await repos.sessions.deleteByContextAndRoles(
			"workflow",
			workflowId,
			["research", "planning", "preflight", "execution", "review"],
		);
		log.workflow.info(
			`Deleted ${deletedCount} post-scoping sessions for workflow ${workflowId}`,
		);

		// Update workflow status to researching
		await this.workflowRepo.transitionStage(workflowId, "researching", null);

		// Start the research agent
		const session = await this.sessionManager.startSession({
			contextType: "workflow",
			contextId: workflowId,
			agentRole: "research",
		});

		await this.workflowRepo.setCurrentSession(workflowId, session.id);

		// Build initial message for research agent
		const scopeCard = await this.artifactRepo.getLatestScopeCard(workflowId);
		if (!scopeCard) {
			throw new Error(`No scope card found for workflow ${workflowId}`);
		}

		const initialMessage = `## Research Phase (Restarted)

The workflow has been rewound to restart research from the approved scope.

### Approved Scope

**${scopeCard.title}**

${scopeCard.description}

**In Scope:**
${scopeCard.inScope.map((item) => `- ${item}`).join("\n")}

**Out of Scope:**
${scopeCard.outOfScope.map((item) => `- ${item}`).join("\n")}

${scopeCard.constraints?.length ? `**Constraints:**\n${scopeCard.constraints.map((item) => `- ${item}`).join("\n")}` : ""}

### Your Task

Investigate the codebase to understand how to implement this scope.
When ready, submit your research findings using the \`submit_research\` tool.`;

		const runner = new AgentRunner(session, {
			projectRoot,
			conversationRepo: this.conversationRepo,
		});

		log.workflow.info(`Starting research agent for workflow ${workflowId}`);

		broadcast(
			createWorkflowStageChangedEvent({
				workflowId,
				previousStage: "scoping",
				newStage: "researching",
				sessionId: session.id,
			}),
		);

		runner.run(initialMessage, { hidden: true }).catch((error) => {
			log.workflow.error(
				`Research agent failed after rewind for workflow ${workflowId}:`,
				error,
			);
			this.errorWorkflow(
				workflowId,
				error instanceof Error ? error.message : "Unknown error",
			);
		});
	}

	/**
	 * Implementation for rewinding to planning stage
	 */
	private async rewindToPlanningImpl(
		workflowId: string,
		projectRoot: string,
	): Promise<void> {
		const repos = getRepositories();

		// Delete all artifacts after research: plans, review cards
		// Keep scope cards and research cards
		await this.artifactRepo.deletePlansByWorkflow(workflowId);
		await this.artifactRepo.deleteReviewCardsByWorkflow(workflowId);

		// Delete all sessions after research
		const deletedCount = await repos.sessions.deleteByContextAndRoles(
			"workflow",
			workflowId,
			["planning", "preflight", "execution", "review"],
		);
		log.workflow.info(
			`Deleted ${deletedCount} post-research sessions for workflow ${workflowId}`,
		);

		// Update workflow status to planning
		await this.workflowRepo.transitionStage(workflowId, "planning", null);

		// Start the planning agent
		const session = await this.sessionManager.startSession({
			contextType: "workflow",
			contextId: workflowId,
			agentRole: "planning",
		});

		await this.workflowRepo.setCurrentSession(workflowId, session.id);

		// Build initial message for planning agent (needs both scope and research)
		const scopeCard = await this.artifactRepo.getLatestScopeCard(workflowId);
		const researchCard =
			await this.artifactRepo.getLatestResearchCard(workflowId);

		if (!scopeCard) {
			throw new Error(`No scope card found for workflow ${workflowId}`);
		}

		if (!researchCard) {
			throw new Error(`No research card found for workflow ${workflowId}`);
		}

		// Build message with BOTH scope and research context
		let initialMessage = `## Planning Phase (Restarted)

The workflow has been rewound to restart planning from the approved research.

## Approved Scope

### Title
${scopeCard.title}

### Description
${scopeCard.description}

### In Scope
${scopeCard.inScope.map((item) => `- ${item}`).join("\n")}

### Out of Scope
${scopeCard.outOfScope.map((item) => `- ${item}`).join("\n")}`;

		if (scopeCard.constraints && scopeCard.constraints.length > 0) {
			initialMessage += `\n\n### Constraints\n${scopeCard.constraints.map((item) => `- ${item}`).join("\n")}`;
		}

		initialMessage += `\n\n---\n\n## Approved Research Findings

### Summary
${researchCard.summary}

### Key Files
${researchCard.keyFiles.map((f) => `- \`${f.path}\`: ${f.purpose}`).join("\n")}

### Recommendations
${researchCard.recommendations.map((r) => `- ${r}`).join("\n")}`;

		if (researchCard.patterns && researchCard.patterns.length > 0) {
			initialMessage += `\n\n### Patterns\n${researchCard.patterns.map((p) => `- **${p.category}**: ${p.description}`).join("\n")}`;
		}

		if (researchCard.challenges && researchCard.challenges.length > 0) {
			initialMessage += `\n\n### Challenges\n${researchCard.challenges.map((c) => `- **${c.issue}**: ${c.mitigation}`).join("\n")}`;
		}

		initialMessage += `\n\n---\n\n### Your Task

Create a detailed execution plan that breaks the implementation into discrete pulses.
When ready, submit your plan using the \`submit_plan\` tool.`;

		const runner = new AgentRunner(session, {
			projectRoot,
			conversationRepo: this.conversationRepo,
		});

		log.workflow.info(`Starting planning agent for workflow ${workflowId}`);

		broadcast(
			createWorkflowStageChangedEvent({
				workflowId,
				previousStage: "researching",
				newStage: "planning",
				sessionId: session.id,
			}),
		);

		runner.run(initialMessage, { hidden: true }).catch((error) => {
			log.workflow.error(
				`Planning agent failed after rewind for workflow ${workflowId}:`,
				error,
			);
			this.errorWorkflow(
				workflowId,
				error instanceof Error ? error.message : "Unknown error",
			);
		});
	}

	/**
	 * Implementation for rewinding to in_progress (execution) stage
	 */
	private async rewindToExecutionImpl(
		workflowId: string,
		projectRoot: string,
	): Promise<void> {
		const repos = getRepositories();

		// Delete review cards (will be recreated after execution completes)
		await this.artifactRepo.deleteReviewCardsByWorkflow(workflowId);

		// Delete all preflight, execution, and review sessions (and their messages)
		const deletedCount = await repos.sessions.deleteByContextAndRoles(
			"workflow",
			workflowId,
			["preflight", "execution", "review"],
		);
		log.workflow.info(
			`Deleted ${deletedCount} execution-phase sessions for workflow ${workflowId}`,
		);

		// Update workflow status to in_progress so transition to review works correctly
		await this.workflowRepo.transitionStage(workflowId, "in_progress", null);

		// Re-initialize pulsing (creates new worktree and branch)
		const pulsingResult =
			await this.pulseOrchestrator.initializePulsing(workflowId);
		if (!pulsingResult.success) {
			throw new Error(`Failed to initialize pulsing: ${pulsingResult.error}`);
		}

		// Recreate pulses from the approved plan
		const plan = await this.artifactRepo.getLatestPlan(workflowId);
		if (!plan) {
			throw new Error(`No approved plan found for workflow ${workflowId}`);
		}

		await this.pulseOrchestrator.createPulsesFromPlan(workflowId, plan.pulses);

		// Create new session for preflight agent
		const session = await this.sessionManager.startSession({
			contextType: "workflow",
			contextId: workflowId,
			agentRole: "preflight",
		});

		// Update workflow with new session
		await this.workflowRepo.setCurrentSession(workflowId, session.id);

		// Create preflight setup record
		await this.pulseOrchestrator.createPreflightSetup(workflowId, session.id);

		// Build initial message for preflight agent
		const worktreePath = pulsingResult.worktreePath;
		const initialMessage = `## Preflight Environment Setup

You are preparing the development environment in an isolated worktree before code execution begins.

**Worktree Path:** \`${worktreePath}\`

### Plan Overview

**Approach:** ${plan.approachSummary}

**Pulses to Execute:** ${plan.pulses.length}
${plan.pulses.map((p) => `- ${p.id}: ${p.title}`).join("\n")}

### Your Task

1. Initialize the development environment (restore dependencies, build, etc.)
2. Record any pre-existing build errors/warnings as baselines using \`record_baseline\`
3. When the environment is ready, call \`complete_preflight\` with a summary

Do NOT modify any tracked files. Only initialize dependencies and build artifacts.`;

		// Start the preflight agent
		const runner = new AgentRunner(session, {
			projectRoot,
			conversationRepo: this.conversationRepo,
			worktreePath,
		});

		log.workflow.info(`Restarting preflight agent for workflow ${workflowId}`);

		// Broadcast stage changed event with new session ID
		broadcast(
			createWorkflowStageChangedEvent({
				workflowId,
				previousStage: "in_progress",
				newStage: "in_progress",
				sessionId: session.id,
			}),
		);

		// Run in background (non-blocking)
		runner.run(initialMessage, { hidden: true }).catch((error) => {
			log.workflow.error(
				`Preflight agent failed after rewind for workflow ${workflowId}:`,
				error,
			);
			this.errorWorkflow(
				workflowId,
				error instanceof Error ? error.message : "Unknown error",
			);
		});
	}

	/**
	 * Implementation for rewinding to review stage (rerun review)
	 *
	 * Unlike other rewinds, this keeps the git worktree and pulse data intact
	 * since execution is complete. It just resets the review card and restarts
	 * the review agent.
	 */
	private async rewindToReviewImpl(
		workflowId: string,
		projectRoot: string,
	): Promise<void> {
		const repos = getRepositories();

		// Get the latest review card
		const reviewCard = await this.artifactRepo.getLatestReviewCard(workflowId);
		if (!reviewCard) {
			throw new Error(`No review card found for workflow ${workflowId}`);
		}

		// Delete all comments and reset the review card
		await this.artifactRepo.deleteReviewComments(reviewCard.id);
		await this.artifactRepo.resetReviewCard(reviewCard.id);

		// Delete review sessions only
		const deletedCount = await repos.sessions.deleteByContextAndRoles(
			"workflow",
			workflowId,
			["review"],
		);
		log.workflow.info(
			`Deleted ${deletedCount} review sessions for workflow ${workflowId}`,
		);

		// Ensure workflow is in review stage
		await this.workflowRepo.transitionStage(workflowId, "review", null);

		// Start a new review agent session
		const session = await this.sessionManager.startSession({
			contextType: "workflow",
			contextId: workflowId,
			agentRole: "review",
		});

		await this.workflowRepo.setCurrentSession(workflowId, session.id);

		// Build initial message for review agent
		const scopeCard = await this.artifactRepo.getLatestScopeCard(workflowId);
		if (!scopeCard) {
			throw new Error(`No scope card found for workflow ${workflowId}`);
		}

		const initialMessage = `## Scope for Review (Restarted)

The review has been restarted. Previous comments have been cleared.

### ${scopeCard.title}

${scopeCard.description}

---

Please review the changes made for this scope. Use the available tools to:
1. Get the diff of all changes using \`get_diff\`
2. Add comments at the line, file, or review level as needed
3. Complete your review with a recommendation (approve, deny, or manual_review)`;

		// Get the worktree path for the review agent
		const worktreePath = getWorktreePath(projectRoot, workflowId);

		const runner = new AgentRunner(session, {
			projectRoot,
			conversationRepo: this.conversationRepo,
			worktreePath,
		});

		log.workflow.info(`Restarting review agent for workflow ${workflowId}`);

		// Broadcast stage changed event with new session ID
		broadcast(
			createWorkflowStageChangedEvent({
				workflowId,
				previousStage: "review",
				newStage: "review",
				sessionId: session.id,
			}),
		);

		// Run in background (non-blocking)
		runner.run(initialMessage, { hidden: true }).catch((error) => {
			log.workflow.error(
				`Review agent failed after rewind for workflow ${workflowId}:`,
				error,
			);
			this.errorWorkflow(
				workflowId,
				error instanceof Error ? error.message : "Unknown error",
			);
		});
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
