/**
 * spawn_review_tasks - Spawn parallel sub-review tasks for focused code review
 *
 * Creates subtask records and spawns subagent sessions for each review task.
 * Each subagent reviews its assigned files and reports findings via submit_sub_review.
 * This is a terminal tool — the coordinator session pauses until all subtasks complete.
 */

import { z } from "zod";
import { AgentRunner } from "@/backend/agents/runner/AgentRunner";
import { getSessionManager } from "@/backend/agents/runner/SessionManager";
import { getProjectDb } from "@/backend/db/project";
import { getDiff } from "@/backend/git";
import { log } from "@/backend/logger";
import { getRepositories } from "@/backend/repositories";
import {
	createSubtask,
	failSubtaskAndCheckDone,
	getMergedSubtaskResults,
	startSubtask,
} from "@/backend/services/subtasks";
import { ids } from "@/backend/utils/ids";
import { broadcast } from "@/backend/ws";
import { createWorkflowErrorEvent } from "@/shared/schemas/events";
import {
	REASON_DESCRIPTION,
	type ToolContext,
	type ToolDefinition,
	type ToolResult,
} from "../types";
import { formatCoordinatorMessage } from "./submitSubReview";

// =============================================================================
// Schema
// =============================================================================

export const spawnReviewTasksInputSchema = z.object({
	reason: z.string().describe(REASON_DESCRIPTION),
	tasks: z
		.array(
			z.object({
				label: z.string(),
				files: z.array(z.string()),
				focusAreas: z.array(z.string()).optional(),
				guidingQuestions: z.array(z.string()).optional(),
			}),
		)
		.min(1),
});

export type SpawnReviewTasksInput = z.infer<typeof spawnReviewTasksInputSchema>;

// =============================================================================
// Helpers
// =============================================================================

/**
 * Build a user message for a sub-review agent with task context and diff content.
 */
function buildSubReviewMessage(
	task: SpawnReviewTasksInput["tasks"][number],
	diffContent: string,
): string {
	const sections: string[] = [];

	sections.push(`# Sub-Review Task: ${task.label}`);
	sections.push(
		`\n## Assigned Files\n${task.files.map((f) => `- ${f}`).join("\n")}`,
	);

	if (task.focusAreas && task.focusAreas.length > 0) {
		sections.push(
			`\n## Focus Areas\n${task.focusAreas.map((a) => `- ${a}`).join("\n")}`,
		);
	}

	if (task.guidingQuestions && task.guidingQuestions.length > 0) {
		sections.push(
			`\n## Guiding Questions\n${task.guidingQuestions.map((q) => `- ${q}`).join("\n")}`,
		);
	}

	// Filter diff to only include relevant files
	const relevantDiff = filterDiffForFiles(diffContent, task.files);
	sections.push(`\n## Diff Content\n\`\`\`diff\n${relevantDiff}\n\`\`\``);

	return sections.join("\n");
}

/**
 * Extract the file path from a `diff --git a/... b/...` line.
 * Returns the path without the leading `a/` or `b/` prefix.
 */
function parseDiffPath(diffLine: string): string | null {
	const match = diffLine.match(/^diff --git a\/(.*) b\/(.*)$/);
	if (!match?.[2]) return null;
	// Use the b/ path (the destination), which reflects renames
	return match[2];
}

/**
 * Filter a unified diff to only include hunks for the specified files.
 * Uses exact path matching to avoid false positives from substring overlap
 * (e.g., `src/foo.ts` must not match `src/foo.tsx`).
 */
function filterDiffForFiles(diffContent: string, files: string[]): string {
	if (!diffContent) return "(no diff content available)";

	const fileSet = new Set(files);
	const lines = diffContent.split("\n");
	const result: string[] = [];
	let include = false;

	for (const line of lines) {
		if (line.startsWith("diff --git")) {
			const path = parseDiffPath(line);
			include = path !== null && fileSet.has(path);
		}
		if (include) {
			result.push(line);
		}
	}

	return result.length > 0
		? result.join("\n")
		: "(no matching diff content for assigned files)";
}

/**
 * Handle a subtask failure: atomically mark it as failed and, if all siblings
 * are now done, resume the coordinator session with merged results.
 */
async function handleSubtaskFailure(
	db: Awaited<ReturnType<typeof getProjectDb>>,
	subtaskId: string,
	context: ToolContext,
	errorMsg: string,
): Promise<void> {
	const result = await failSubtaskAndCheckDone(db, subtaskId, errorMsg);

	if (result.shouldResumeCoordinator) {
		const parentSessionId = result.parentSessionId;
		log.tools.info(
			`All subtasks done (via failure) for coordinator session ${parentSessionId} — resuming coordinator`,
		);

		const merged = await getMergedSubtaskResults(db, parentSessionId);
		const coordinatorMessage = formatCoordinatorMessage(merged);

		const sessionManager = getSessionManager();
		const coordinatorSession =
			await sessionManager.getOrRestoreSession(parentSessionId);

		if (coordinatorSession) {
			const { conversations: conversationRepo } = getRepositories();
			const runner = new AgentRunner(coordinatorSession, {
				projectRoot: context.projectRoot,
				conversationRepo,
				worktreePath: context.worktreePath,
			});

			runner.run(coordinatorMessage).catch((err) => {
				const resumeError =
					err instanceof Error ? err.message : "unknown error";
				log.tools.error(
					`Failed to resume coordinator session ${parentSessionId}: ${resumeError}`,
				);
				if (context.workflowId) {
					broadcast(
						createWorkflowErrorEvent({
							workflowId: context.workflowId,
							error: `Failed to resume review coordinator after subtask completion: ${resumeError}`,
						}),
					);
				}
			});
		} else {
			log.tools.error(
				`Coordinator session ${parentSessionId} not found — cannot resume`,
			);
			if (context.workflowId) {
				broadcast(
					createWorkflowErrorEvent({
						workflowId: context.workflowId,
						error: `Coordinator session ${parentSessionId} not found — cannot resume after subtask completion`,
					}),
				);
			}
		}
	}
}

// =============================================================================
// Tool Definition
// =============================================================================

export const spawnReviewTasksTool: ToolDefinition<SpawnReviewTasksInput> = {
	name: "spawn_review_tasks",
	description: `Spawn parallel sub-review tasks for focused code review.
Each task creates a subagent that reviews the assigned files and reports findings.
This is a terminal tool — your session will pause until all subtasks complete.
Use this when the diff is large enough to benefit from parallel focused reviews.`,
	inputSchema: spawnReviewTasksInputSchema,
	execute: async (input, context): Promise<ToolResult> => {
		// Validate required context
		if (!context.workflowId) {
			return {
				success: false,
				output:
					"Error: No workflow context - spawn_review_tasks can only be used in workflow sessions",
			};
		}

		if (!context.sessionId) {
			return {
				success: false,
				output:
					"Error: No session context - spawn_review_tasks requires an active session",
			};
		}

		try {
			const db = await getProjectDb(context.projectRoot);
			const { conversations: conversationRepo } = getRepositories();

			// Fetch the workflow to get base_branch for diff
			const workflow = await db
				.selectFrom("workflows")
				.select(["base_branch"])
				.where("id", "=", context.workflowId)
				.executeTakeFirst();

			if (!workflow?.base_branch) {
				return {
					success: false,
					output:
						"Error: Workflow has no base_branch set - cannot compute diff for subtasks",
				};
			}

			const workflowBranch = `autarch/${context.workflowId}`;
			let diffContent = "";
			try {
				diffContent = await getDiff(
					context.projectRoot,
					workflow.base_branch,
					workflowBranch,
				);
			} catch (err) {
				log.tools.warn(
					`Failed to get diff for subtask spawning: ${err instanceof Error ? err.message : "unknown error"}`,
				);
			}

			// Server-generate subtask IDs to avoid PK collisions from LLM-provided IDs.
			// Map from generated ID to task for spawning.
			const subtaskEntries: Array<{
				subtaskId: string;
				task: (typeof input.tasks)[number];
			}> = [];
			for (const task of input.tasks) {
				const subtaskId = ids.subtask();
				await createSubtask(db, {
					id: subtaskId,
					parentSessionId: context.sessionId,
					workflowId: context.workflowId,
					taskDefinition: task,
				});
				subtaskEntries.push({ subtaskId, task });
			}

			const sessionManager = getSessionManager();

			for (const { subtaskId, task } of subtaskEntries) {
				try {
					// Spawn subagent session
					const subSession = await sessionManager.startSession({
						contextType: "subtask",
						contextId: subtaskId,
						agentRole: "review_sub",
					});

					// Update session record with parent_session_id since startSession
					// doesn't accept it directly
					await db
						.updateTable("sessions")
						.set({ parent_session_id: context.sessionId })
						.where("id", "=", subSession.id)
						.execute();

					// Mark subtask as running
					await startSubtask(db, subtaskId);

					// Construct runner for the subagent
					const runner = new AgentRunner(subSession, {
						projectRoot: context.projectRoot,
						conversationRepo,
						worktreePath: context.worktreePath,
					});

					// Build the user message with task context and relevant diff
					const userMessage = buildSubReviewMessage(task, diffContent);

					// Fire-and-forget: run the subagent without awaiting completion
					runner.run(userMessage).catch(async (err) => {
						const errorMsg =
							err instanceof Error ? err.message : "Unknown error";
						log.tools.error(`Subtask ${subtaskId} runner failed: ${errorMsg}`);
						try {
							await handleSubtaskFailure(db, subtaskId, context, errorMsg);
						} catch (failErr) {
							log.tools.error(
								`Failed to mark subtask ${subtaskId} as failed: ${failErr instanceof Error ? failErr.message : "unknown"}`,
							);
						}
					});
				} catch (err) {
					const errorMsg = err instanceof Error ? err.message : "Unknown error";
					log.tools.error(`Failed to spawn subtask ${subtaskId}: ${errorMsg}`);
					await handleSubtaskFailure(db, subtaskId, context, errorMsg);
				}
			}

			return {
				success: true,
				output: `Spawned ${input.tasks.length} review subtasks. Your session will resume when all subtasks complete.`,
			};
		} catch (error) {
			return {
				success: false,
				output: `Error: Failed to spawn review tasks: ${error instanceof Error ? error.message : "unknown error"}`,
			};
		}
	},
};
