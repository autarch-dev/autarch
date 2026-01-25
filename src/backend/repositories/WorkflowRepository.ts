/**
 * WorkflowRepository - Data access for workflows
 *
 * Consolidates all workflow database operations and provides
 * consistent domain object mapping.
 */

import type { WorkflowsTable } from "@/backend/db/project/types";
import { ids } from "@/backend/utils";
import type { PendingArtifactType } from "@/shared/schemas/events";
import type {
	Workflow,
	WorkflowPriority,
	WorkflowStatus,
} from "@/shared/schemas/workflow";
import type { ProjectDb, Repository } from "./types";

// =============================================================================
// Types
// =============================================================================

export interface CreateWorkflowData {
	title: string;
	description?: string;
	priority?: WorkflowPriority;
	status?: WorkflowStatus;
	skippedStages?: string[];
}

// =============================================================================
// Repository
// =============================================================================

export class WorkflowRepository implements Repository {
	constructor(readonly db: ProjectDb) {}

	// ===========================================================================
	// Domain Mapping
	// ===========================================================================

	/**
	 * Convert a database row to a domain Workflow object.
	 * Single source of truth for this mapping.
	 */
	private toWorkflow(row: WorkflowsTable): Workflow {
		return {
			id: row.id,
			title: row.title,
			description: row.description ?? undefined,
			status: row.status,
			priority: row.priority,
			currentSessionId: row.current_session_id ?? undefined,
			awaitingApproval: row.awaiting_approval === 1,
			archived: row.archived === 1,
			pendingArtifactType: row.pending_artifact_type ?? undefined,
			baseBranch: row.base_branch ?? undefined,
			skippedStages: row.skipped_stages ? JSON.parse(row.skipped_stages) : [],
			createdAt: row.created_at,
			updatedAt: row.updated_at,
		};
	}

	// ===========================================================================
	// Read Operations
	// ===========================================================================

	/**
	 * Get a workflow by ID
	 */
	async getById(id: string): Promise<Workflow | null> {
		const row = await this.db
			.selectFrom("workflows")
			.selectAll()
			.where("id", "=", id)
			.executeTakeFirst();

		return row ? this.toWorkflow(row) : null;
	}

	/**
	 * List all workflows, optionally ordered
	 */
	async list(
		options: { orderBy?: "created" | "updated" } = {},
	): Promise<Workflow[]> {
		const { orderBy = "updated" } = options;

		const rows = await this.db
			.selectFrom("workflows")
			.selectAll()
			.where("archived", "=", 0)
			.orderBy(orderBy === "created" ? "created_at" : "updated_at", "desc")
			.execute();

		return rows.map((row) => this.toWorkflow(row));
	}

	// ===========================================================================
	// Write Operations
	// ===========================================================================

	/**
	 * Create a new workflow
	 */
	async create(data: CreateWorkflowData): Promise<Workflow> {
		const now = Date.now();
		const workflowId = ids.workflow();

		await this.db
			.insertInto("workflows")
			.values({
				id: workflowId,
				title: data.title,
				description: data.description ?? null,
				status: data.status ?? "scoping",
				priority: data.priority ?? "medium",
				current_session_id: null,
				awaiting_approval: 0,
				archived: 0,
				pending_artifact_type: null,
				skipped_stages: JSON.stringify(data.skippedStages || []),
				created_at: now,
				updated_at: now,
			})
			.execute();

		// Return the created workflow
		const workflow = await this.getById(workflowId);
		if (!workflow) {
			throw new Error(`Failed to create workflow: ${workflowId}`);
		}
		return workflow;
	}

	/**
	 * Update workflow status
	 */
	async updateStatus(id: string, status: WorkflowStatus): Promise<void> {
		await this.db
			.updateTable("workflows")
			.set({
				status,
				updated_at: Date.now(),
			})
			.where("id", "=", id)
			.execute();
	}

	/**
	 * Set the current session for a workflow
	 */
	async setCurrentSession(id: string, sessionId: string | null): Promise<void> {
		await this.db
			.updateTable("workflows")
			.set({
				current_session_id: sessionId,
				updated_at: Date.now(),
			})
			.where("id", "=", id)
			.execute();
	}

	/**
	 * Mark workflow as awaiting approval
	 */
	async setAwaitingApproval(
		id: string,
		artifactType: PendingArtifactType,
	): Promise<void> {
		await this.db
			.updateTable("workflows")
			.set({
				awaiting_approval: 1,
				pending_artifact_type: artifactType,
				updated_at: Date.now(),
			})
			.where("id", "=", id)
			.execute();
	}

	/**
	 * Clear awaiting approval state
	 */
	async clearAwaitingApproval(id: string): Promise<void> {
		await this.db
			.updateTable("workflows")
			.set({
				awaiting_approval: 0,
				pending_artifact_type: null,
				updated_at: Date.now(),
			})
			.where("id", "=", id)
			.execute();
	}

	/**
	 * Archive a workflow (hides from list)
	 */
	async archive(id: string): Promise<void> {
		await this.db
			.updateTable("workflows")
			.set({
				archived: 1,
				updated_at: Date.now(),
			})
			.where("id", "=", id)
			.execute();
	}

	/**
	 * Update workflow for stage transition
	 */
	async transitionStage(
		id: string,
		newStatus: WorkflowStatus,
		sessionId: string | null,
	): Promise<void> {
		await this.db
			.updateTable("workflows")
			.set({
				status: newStatus,
				current_session_id: sessionId,
				awaiting_approval: 0,
				pending_artifact_type: null,
				updated_at: Date.now(),
			})
			.where("id", "=", id)
			.execute();
	}

	/**
	 * Set the base branch for a workflow (captured when transitioning to in_progress)
	 */
	async setBaseBranch(id: string, baseBranch: string): Promise<void> {
		await this.db
			.updateTable("workflows")
			.set({
				base_branch: baseBranch,
				updated_at: Date.now(),
			})
			.where("id", "=", id)
			.execute();
	}

	/**
	 * Set the skipped stages for a workflow (e.g., ['researching', 'planning'] for quick path)
	 */
	async setSkippedStages(id: string, skippedStages: string[]): Promise<void> {
		await this.db
			.updateTable("workflows")
			.set({
				skipped_stages: JSON.stringify(skippedStages),
				updated_at: Date.now(),
			})
			.where("id", "=", id)
			.execute();
	}
}
