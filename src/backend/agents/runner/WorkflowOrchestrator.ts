/**
 * WorkflowOrchestrator - Manages workflow lifecycle and stage transitions
 *
 * Handles:
 * - Creating new workflows
 * - Processing stage-completion tools (scope_card_submit, plan_submit, etc.)
 * - Managing approval gates (most transitions require user approval)
 * - Spawning appropriate agents for each stage
 */

import type { Kysely } from "kysely";
import type { ProjectDatabase } from "@/backend/db/project";
import { findRepoRoot } from "@/backend/git";
import { log } from "@/backend/logger";
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
	in_progress: "execution",
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
	constructor(
		private sessionManager: SessionManager,
		private db: Kysely<ProjectDatabase>,
	) {}

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
		const now = Date.now();
		const workflowId = generateWorkflowId();

		// Insert workflow
		await this.db
			.insertInto("workflows")
			.values({
				id: workflowId,
				title,
				description: description ?? null,
				status: "scoping",
				priority,
				current_session_id: null,
				awaiting_approval: 0,
				pending_artifact_type: null,
				created_at: now,
				updated_at: now,
			})
			.execute();

		// Broadcast creation event
		broadcast(
			createWorkflowCreatedEvent({
				workflowId,
				title,
				status: "scoping",
			}),
		);

		// Start the scoping agent session
		const session = await this.sessionManager.startSession({
			contextType: "workflow",
			contextId: workflowId,
			agentRole: "scoping",
		});

		// Update workflow with session ID
		await this.db
			.updateTable("workflows")
			.set({ current_session_id: session.id, updated_at: Date.now() })
			.where("id", "=", workflowId)
			.execute();

		// Build the initial prompt from title and description
		const initialPrompt = description
			? `${title}\n\n${description}`
			: title;

		// Run the scoping agent with the initial prompt (non-blocking)
		const projectRoot = findRepoRoot(process.cwd());
		const runner = new AgentRunner(session, { projectRoot, db: this.db });

		runner.run(initialPrompt).catch((error) => {
			log.agent.error(`Scoping agent failed for workflow ${workflowId}:`, error);
			this.sessionManager.errorSession(
				session.id,
				error instanceof Error ? error.message : "Unknown error",
			);
		});

		return {
			id: workflowId,
			title,
			description,
			status: "scoping",
			priority,
			currentSessionId: session.id,
			awaitingApproval: false,
			pendingArtifactType: undefined,
			createdAt: now,
			updatedAt: now,
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
	 */
	async handleToolResult(
		workflowId: string,
		toolName: string,
		artifactId: string,
	): Promise<StageTransitionResult> {
		log.workflow.info(
			`handleToolResult: workflowId=${workflowId}, toolName=${toolName}, artifactId=${artifactId}`,
		);

		// Check if this is an approval-required tool
		const approvalTargetStage = APPROVAL_REQUIRED_TOOLS[toolName];
		if (approvalTargetStage) {
			const artifactType = TOOL_TO_ARTIFACT_TYPE[toolName];
			if (!artifactType) {
				log.workflow.error(
					`No artifact type mapping for tool ${toolName}`,
				);
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
		const now = Date.now();

		await this.db
			.updateTable("workflows")
			.set({
				awaiting_approval: 1,
				pending_artifact_type: artifactType,
				updated_at: now,
			})
			.where("id", "=", workflowId)
			.execute();

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
		const workflow = await this.getWorkflow(workflowId);
		if (!workflow) {
			throw new Error(`Workflow not found: ${workflowId}`);
		}

		if (!workflow.awaitingApproval) {
			throw new Error(`Workflow ${workflowId} is not awaiting approval`);
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
	 * User requests changes → agent continues in same stage
	 */
	async requestChanges(workflowId: string, feedback: string): Promise<void> {
		const workflow = await this.getWorkflow(workflowId);
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

		const now = Date.now();

		// Clear awaiting approval state
		await this.db
			.updateTable("workflows")
			.set({
				awaiting_approval: 0,
				pending_artifact_type: null,
				updated_at: now,
			})
			.where("id", "=", workflowId)
			.execute();

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
			db: this.db,
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
		const workflow = await this.getWorkflow(workflowId);
		if (!workflow) {
			throw new Error(`Workflow not found: ${workflowId}`);
		}

		const previousStage = workflow.status;
		const now = Date.now();

		// Stop current session if any
		if (workflow.currentSessionId) {
			await this.sessionManager.stopSession(workflow.currentSessionId);
		}

		// Check if workflow is complete
		if (newStage === "done") {
			await this.db
				.updateTable("workflows")
				.set({
					status: "done",
					current_session_id: null,
					awaiting_approval: 0,
					pending_artifact_type: null,
					updated_at: now,
				})
				.where("id", "=", workflowId)
				.execute();

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
		await this.db
			.updateTable("workflows")
			.set({
				status: newStage,
				current_session_id: session.id,
				awaiting_approval: 0,
				pending_artifact_type: null,
				updated_at: now,
			})
			.where("id", "=", workflowId)
			.execute();

		// Broadcast stage change event
		broadcast(
			createWorkflowStageChangedEvent({
				workflowId,
				previousStage,
				newStage,
				sessionId: session.id,
			}),
		);

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
		const workflow = await this.getWorkflow(workflowId);
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
	// Helpers
	// ===========================================================================

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
		const row = await this.db
			.selectFrom("workflows")
			.selectAll()
			.where("id", "=", workflowId)
			.executeTakeFirst();

		if (!row) {
			return null;
		}

		return {
			id: row.id,
			title: row.title,
			description: row.description ?? undefined,
			status: row.status,
			priority: row.priority,
			currentSessionId: row.current_session_id ?? undefined,
			awaitingApproval: row.awaiting_approval === 1,
			pendingArtifactType: row.pending_artifact_type ?? undefined,
			createdAt: row.created_at,
			updatedAt: row.updated_at,
		};
	}
}

// =============================================================================
// Helpers
// =============================================================================

function generateWorkflowId(): string {
	return `wf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
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
	db: Kysely<ProjectDatabase>,
): WorkflowOrchestrator {
	orchestratorInstance = new WorkflowOrchestrator(sessionManager, db);
	return orchestratorInstance;
}
