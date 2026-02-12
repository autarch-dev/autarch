/**
 * Subtask service utilities
 *
 * Generic utility functions for operating on the subtasks table.
 * Not review-specific — designed for reuse by any agent that delegates work.
 */

import { AgentRunner } from "@/backend/agents/runner/AgentRunner";
import { getSessionManager } from "@/backend/agents/runner/SessionManager";
import type { SubtaskStatus, SubtasksTable } from "@/backend/db/project/types";
import { log } from "@/backend/logger";
import { getRepositories } from "@/backend/repositories";
import type { ProjectDb } from "@/backend/repositories/types";
import { broadcast } from "@/backend/ws/index";
import {
	createSubtaskUpdatedEvent,
	createWorkflowErrorEvent,
} from "@/shared/schemas/events";

// =============================================================================
// Types
// =============================================================================

export interface CreateSubtaskParams {
	id: string;
	parentSessionId: string;
	workflowId: string;
	taskDefinition: object;
}

export interface SubtaskRow {
	id: string;
	parentSessionId: string;
	workflowId: string;
	taskDefinition: string;
	findings: string | null;
	status: SubtaskStatus;
	createdAt: number;
	updatedAt: number;
}

export interface AllSubtasksStatus {
	allDone: boolean;
	completed: SubtaskRow[];
	failed: SubtaskRow[];
	pending: SubtaskRow[];
}

export interface SubtaskTransitionResult {
	/** Whether all sibling subtasks have reached a terminal state */
	allDone: boolean;
	/** Whether THIS caller is the one that should resume the coordinator.
	 * Only true for exactly one caller when allDone is true. */
	shouldResumeCoordinator: boolean;
	parentSessionId: string;
}

/**
 * Minimal context required by resumeCoordinatorSession.
 * Avoids coupling to the full ToolContext type.
 */
export interface ResumeContext {
	projectRoot: string;
	worktreePath?: string;
	workflowId?: string;
}

export interface MergedSubtaskResults {
	completedFindings: Array<{
		subtaskId: string;
		label: string;
		findings: unknown;
	}>;
	failedTasks: Array<{
		subtaskId: string;
		label: string;
		error: string;
	}>;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Convert a database row to a SubtaskRow domain object.
 */
function toSubtaskRow(row: SubtasksTable): SubtaskRow {
	return {
		id: row.id,
		parentSessionId: row.parent_session_id,
		workflowId: row.workflow_id,
		taskDefinition: row.task_definition,
		findings: row.findings,
		status: row.status,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

/**
 * Extract the label from a JSON-encoded task definition.
 */
function getLabel(taskDefinition: string): string {
	try {
		const parsed = JSON.parse(taskDefinition);
		return parsed.label ?? "Subtask";
	} catch {
		return "Subtask";
	}
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Create a new subtask record with status='pending'.
 * Broadcasts a subtask:updated WebSocket event.
 */
export async function createSubtask(
	db: ProjectDb,
	params: CreateSubtaskParams,
): Promise<SubtaskRow> {
	const now = Date.now();
	const taskDefinitionJson = JSON.stringify(params.taskDefinition);

	await db
		.insertInto("subtasks")
		.values({
			id: params.id,
			parent_session_id: params.parentSessionId,
			workflow_id: params.workflowId,
			task_definition: taskDefinitionJson,
			findings: null,
			status: "pending",
			created_at: now,
			updated_at: now,
		})
		.execute();

	const row: SubtaskRow = {
		id: params.id,
		parentSessionId: params.parentSessionId,
		workflowId: params.workflowId,
		taskDefinition: taskDefinitionJson,
		findings: null,
		status: "pending",
		createdAt: now,
		updatedAt: now,
	};

	broadcast(
		createSubtaskUpdatedEvent({
			workflowId: params.workflowId,
			subtaskId: params.id,
			parentSessionId: params.parentSessionId,
			label: getLabel(taskDefinitionJson),
			status: "pending",
		}),
	);

	return row;
}

/**
 * Mark a subtask as running.
 * Broadcasts a subtask:updated WebSocket event.
 */
export async function startSubtask(
	db: ProjectDb,
	subtaskId: string,
): Promise<void> {
	const now = Date.now();

	await db
		.updateTable("subtasks")
		.set({
			status: "running",
			updated_at: now,
		})
		.where("id", "=", subtaskId)
		.execute();

	const row = await db
		.selectFrom("subtasks")
		.selectAll()
		.where("id", "=", subtaskId)
		.executeTakeFirst();

	if (row) {
		broadcast(
			createSubtaskUpdatedEvent({
				workflowId: row.workflow_id,
				subtaskId: row.id,
				parentSessionId: row.parent_session_id,
				label: getLabel(row.task_definition),
				status: "running",
			}),
		);
	}
}

/**
 * Atomically mark a subtask as completed and check whether all sibling subtasks are done.
 *
 * Uses a SQLite transaction to ensure that when two subtasks complete near-simultaneously,
 * only one caller observes `shouldResumeCoordinator === true`. SQLite serializes write
 * transactions, so the complete-then-check sequence is atomic.
 */
export async function completeSubtaskAndCheckDone(
	db: ProjectDb,
	subtaskId: string,
	findings: object,
): Promise<SubtaskTransitionResult> {
	const now = Date.now();
	const findingsJson = JSON.stringify(findings);

	const result = await db.transaction().execute(async (tx) => {
		// 1. Mark the subtask as completed
		await tx
			.updateTable("subtasks")
			.set({
				status: "completed",
				findings: findingsJson,
				updated_at: now,
			})
			.where("id", "=", subtaskId)
			.execute();

		// 2. Read back the completed row for broadcast and parentSessionId
		const row = await tx
			.selectFrom("subtasks")
			.selectAll()
			.where("id", "=", subtaskId)
			.executeTakeFirst();

		if (!row) {
			throw new Error(`Subtask ${subtaskId} not found after update`);
		}

		// 3. Count siblings still in non-terminal state
		const pendingCount = await tx
			.selectFrom("subtasks")
			.select(tx.fn.countAll().as("count"))
			.where("parent_session_id", "=", row.parent_session_id)
			.where("status", "not in", ["completed", "failed"])
			.executeTakeFirstOrThrow();

		const allDone = Number(pendingCount.count) === 0;

		return { row, allDone };
	});

	// Broadcast outside the transaction
	broadcast(
		createSubtaskUpdatedEvent({
			workflowId: result.row.workflow_id,
			subtaskId: result.row.id,
			parentSessionId: result.row.parent_session_id,
			label: getLabel(result.row.task_definition),
			status: "completed",
			findings,
		}),
	);

	return {
		allDone: result.allDone,
		shouldResumeCoordinator: result.allDone,
		parentSessionId: result.row.parent_session_id,
	};
}

/**
 * Mark a subtask as failed with an optional error message.
 * Broadcasts a subtask:updated WebSocket event.
 */
export async function failSubtask(
	db: ProjectDb,
	subtaskId: string,
	error?: string,
): Promise<void> {
	const now = Date.now();
	const findingsJson = JSON.stringify({ error: error ?? "Unknown error" });

	await db
		.updateTable("subtasks")
		.set({
			status: "failed",
			findings: findingsJson,
			updated_at: now,
		})
		.where("id", "=", subtaskId)
		.execute();

	const row = await db
		.selectFrom("subtasks")
		.selectAll()
		.where("id", "=", subtaskId)
		.executeTakeFirst();

	if (row) {
		broadcast(
			createSubtaskUpdatedEvent({
				workflowId: row.workflow_id,
				subtaskId: row.id,
				parentSessionId: row.parent_session_id,
				label: getLabel(row.task_definition),
				status: "failed",
			}),
		);
	}
}

/**
 * Atomically mark a subtask as failed and check whether all sibling subtasks are done.
 *
 * Uses a SQLite transaction to ensure that when multiple subtasks fail near-simultaneously,
 * only one caller observes `shouldResumeCoordinator === true`. This prevents the coordinator
 * from being stuck forever when all subtasks fail.
 */
export async function failSubtaskAndCheckDone(
	db: ProjectDb,
	subtaskId: string,
	error?: string,
): Promise<SubtaskTransitionResult> {
	const now = Date.now();
	const findingsJson = JSON.stringify({ error: error ?? "Unknown error" });

	const result = await db.transaction().execute(async (tx) => {
		// 1. Mark the subtask as failed
		await tx
			.updateTable("subtasks")
			.set({
				status: "failed",
				findings: findingsJson,
				updated_at: now,
			})
			.where("id", "=", subtaskId)
			.execute();

		// 2. Read back the failed row for broadcast and parentSessionId
		const row = await tx
			.selectFrom("subtasks")
			.selectAll()
			.where("id", "=", subtaskId)
			.executeTakeFirst();

		if (!row) {
			throw new Error(`Subtask ${subtaskId} not found after update`);
		}

		// 3. Count siblings still in non-terminal state
		const pendingCount = await tx
			.selectFrom("subtasks")
			.select(tx.fn.countAll().as("count"))
			.where("parent_session_id", "=", row.parent_session_id)
			.where("status", "not in", ["completed", "failed"])
			.executeTakeFirstOrThrow();

		const allDone = Number(pendingCount.count) === 0;

		return { row, allDone };
	});

	// Broadcast outside the transaction
	broadcast(
		createSubtaskUpdatedEvent({
			workflowId: result.row.workflow_id,
			subtaskId: result.row.id,
			parentSessionId: result.row.parent_session_id,
			label: getLabel(result.row.task_definition),
			status: "failed",
		}),
	);

	return {
		allDone: result.allDone,
		shouldResumeCoordinator: result.allDone,
		parentSessionId: result.row.parent_session_id,
	};
}

/**
 * Check whether all subtasks for a parent session are done.
 * Returns categorized subtask arrays and an allDone flag.
 */
export async function checkAllSubtasksDone(
	db: ProjectDb,
	parentSessionId: string,
): Promise<AllSubtasksStatus> {
	const rows = await db
		.selectFrom("subtasks")
		.selectAll()
		.where("parent_session_id", "=", parentSessionId)
		.execute();

	const subtasks = rows.map(toSubtaskRow);

	const completed = subtasks.filter((s) => s.status === "completed");
	const failed = subtasks.filter((s) => s.status === "failed");
	const pending = subtasks.filter(
		(s) => s.status === "pending" || s.status === "running",
	);

	return {
		allDone: pending.length === 0,
		completed,
		failed,
		pending,
	};
}

/**
 * Get merged results from all subtasks for a parent session.
 * Used to build the coordinator resume message with sub-findings.
 */
export async function getMergedSubtaskResults(
	db: ProjectDb,
	parentSessionId: string,
): Promise<MergedSubtaskResults> {
	const rows = await db
		.selectFrom("subtasks")
		.selectAll()
		.where("parent_session_id", "=", parentSessionId)
		.execute();

	const completedFindings: MergedSubtaskResults["completedFindings"] = [];
	const failedTasks: MergedSubtaskResults["failedTasks"] = [];

	for (const row of rows) {
		const label = getLabel(row.task_definition);

		if (row.status === "completed" && row.findings) {
			let findings: unknown;
			try {
				findings = JSON.parse(row.findings);
			} catch {
				findings = row.findings;
			}
			completedFindings.push({
				subtaskId: row.id,
				label,
				findings,
			});
		} else if (row.status === "failed") {
			let error = "Unknown error";
			if (row.findings) {
				try {
					const parsed = JSON.parse(row.findings);
					error = parsed.error ?? "Unknown error";
				} catch {
					error = row.findings;
				}
			}
			failedTasks.push({
				subtaskId: row.id,
				label,
				error,
			});
		}
	}

	return { completedFindings, failedTasks };
}

/**
 * Resume a coordinator session with a merged message after all subtasks are done.
 *
 * Restores the coordinator session, creates an AgentRunner, and fires off the
 * run in the background. Logs and broadcasts errors on failure. This is the
 * single place that owns the "get session → build runner → run → handle errors"
 * flow so that callers (spawnReviewTasks, submitSubReview) stay concise.
 */
export function resumeCoordinatorSession(
	parentSessionId: string,
	context: ResumeContext,
	coordinatorMessage: string,
): void {
	const sessionManager = getSessionManager();

	sessionManager
		.getOrRestoreSession(parentSessionId)
		.then(async (coordinatorSession) => {
			if (coordinatorSession) {
				const { conversations: conversationRepo } = getRepositories();
				const runner = new AgentRunner(coordinatorSession, {
					projectRoot: context.projectRoot,
					conversationRepo,
					worktreePath: context.worktreePath,
				});

				runner.run(coordinatorMessage).catch(async (err) => {
					const resumeError =
						err instanceof Error ? err.message : "unknown error";
					log.tools.error(
						`Failed to resume coordinator session ${parentSessionId}: ${resumeError}`,
					);
					if (context.workflowId) {
						const errorMsg = `Failed to resume review coordinator after subtask completion: ${resumeError}`;
						broadcast(
							createWorkflowErrorEvent({
								workflowId: context.workflowId,
								error: errorMsg,
							}),
						);
						try {
							const { analytics, workflows } = getRepositories();
							const wf = await workflows.getById(context.workflowId);
							await analytics.insertWorkflowError({
								workflowId: context.workflowId,
								stage: wf?.status ?? "unknown",
								errorType: "subtask_error",
								errorMessage: errorMsg,
							});
						} catch (analyticsErr) {
							log.tools.warn("Failed to record workflow error", {
								analyticsErr,
							});
						}
					}
				});
			} else {
				log.tools.error(
					`Coordinator session ${parentSessionId} not found — cannot resume`,
				);
				if (context.workflowId) {
					const errorMsg = `Coordinator session ${parentSessionId} not found — cannot resume after subtask completion`;
					broadcast(
						createWorkflowErrorEvent({
							workflowId: context.workflowId,
							error: errorMsg,
						}),
					);
					try {
						const { analytics, workflows } = getRepositories();
						const wf = await workflows.getById(context.workflowId);
						await analytics.insertWorkflowError({
							workflowId: context.workflowId,
							stage: wf?.status ?? "unknown",
							errorType: "subtask_error",
							errorMessage: errorMsg,
						});
					} catch (analyticsErr) {
						log.tools.warn("Failed to record workflow error", { analyticsErr });
					}
				}
			}
		})
		.catch(async (err) => {
			const resumeError = err instanceof Error ? err.message : "unknown error";
			log.tools.error(
				`Failed to restore coordinator session ${parentSessionId}: ${resumeError}`,
			);
			if (context.workflowId) {
				const errorMsg = `Failed to restore coordinator session ${parentSessionId}: ${resumeError}`;
				broadcast(
					createWorkflowErrorEvent({
						workflowId: context.workflowId,
						error: errorMsg,
					}),
				);
				try {
					const { analytics, workflows } = getRepositories();
					const wf = await workflows.getById(context.workflowId);
					await analytics.insertWorkflowError({
						workflowId: context.workflowId,
						stage: wf?.status ?? "unknown",
						errorType: "subtask_error",
						errorMessage: errorMsg,
					});
				} catch (analyticsErr) {
					log.tools.warn("Failed to record workflow error", { analyticsErr });
				}
			}
		});
}
