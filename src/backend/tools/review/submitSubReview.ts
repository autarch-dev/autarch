/**
 * submit_sub_review - Submit findings from a sub-review task
 *
 * Called by subagent sessions to report their review findings.
 * Stores findings in the subtask record and checks if all sibling subtasks are done.
 * When all subtasks complete, resumes the coordinator session with merged findings.
 */

import { z } from "zod";
import { AgentRunner } from "@/backend/agents/runner/AgentRunner";
import { getSessionManager } from "@/backend/agents/runner/SessionManager";
import { getProjectDb } from "@/backend/db/project";
import { log } from "@/backend/logger";
import { getRepositories } from "@/backend/repositories";
import {
	checkAllSubtasksDone,
	completeSubtask,
	getMergedSubtaskResults,
} from "@/backend/services/subtasks";
import {
	REASON_DESCRIPTION,
	type ToolDefinition,
	type ToolResult,
} from "../types";

// =============================================================================
// Schema
// =============================================================================

export const submitSubReviewInputSchema = z.object({
	reason: z.string().describe(REASON_DESCRIPTION),
	summary: z.string().describe("Summary of the sub-review findings"),
	concerns: z
		.array(
			z.object({
				severity: z
					.enum(["critical", "major", "minor", "suggestion"])
					.describe("Severity level of the concern"),
				description: z.string().describe("Description of the concern"),
				file: z
					.string()
					.optional()
					.describe("File path related to the concern"),
				line: z
					.number()
					.optional()
					.describe("Line number related to the concern"),
			}),
		)
		.optional()
		.describe("List of concerns found during review"),
	positiveObservations: z
		.array(z.string())
		.optional()
		.describe("Positive observations about the code"),
});

export type SubmitSubReviewInput = z.infer<typeof submitSubReviewInputSchema>;

// =============================================================================
// Helpers
// =============================================================================

/**
 * Format merged subtask results into a readable coordinator message.
 */
function formatCoordinatorMessage(
	merged: Awaited<ReturnType<typeof getMergedSubtaskResults>>,
): string {
	const sections: string[] = [];

	sections.push("# Sub-Review Results\n");
	sections.push(
		"All sub-review tasks have completed. Below are the merged findings from each subtask.\n",
	);

	// Completed findings
	for (const entry of merged.completedFindings) {
		sections.push(`## ${entry.label}\n`);

		const findings = entry.findings as {
			summary?: string;
			concerns?: Array<{
				severity: string;
				description: string;
				file?: string;
				line?: number;
			}>;
			positiveObservations?: string[];
		};

		if (findings.summary) {
			sections.push(`**Summary:** ${findings.summary}\n`);
		}

		if (findings.concerns && findings.concerns.length > 0) {
			sections.push("**Concerns:**");
			for (const concern of findings.concerns) {
				const location = concern.file
					? concern.line
						? ` (${concern.file}:${concern.line})`
						: ` (${concern.file})`
					: "";
				sections.push(
					`- [${concern.severity.toUpperCase()}]${location} ${concern.description}`,
				);
			}
			sections.push("");
		}

		if (
			findings.positiveObservations &&
			findings.positiveObservations.length > 0
		) {
			sections.push("**Positive Observations:**");
			for (const obs of findings.positiveObservations) {
				sections.push(`- ${obs}`);
			}
			sections.push("");
		}
	}

	// Failed tasks
	if (merged.failedTasks.length > 0) {
		sections.push("## Failed Subtasks\n");
		sections.push(
			"The following subtasks failed and may need retry or manual review:\n",
		);
		for (const task of merged.failedTasks) {
			sections.push(`- **${task.label}**: ${task.error}`);
		}
		sections.push("");
	}

	sections.push(
		"---\n\nReview the above findings for cross-cutting concerns, then produce the final review using complete_review.",
	);

	return sections.join("\n");
}

// =============================================================================
// Tool Definition
// =============================================================================

export const submitSubReviewTool: ToolDefinition<SubmitSubReviewInput> = {
	name: "submit_sub_review",
	description: `Submit your sub-review findings.
Call this tool once you have completed reviewing your assigned files.
Include a summary, any concerns found, and positive observations.
This is a terminal tool — your session ends after submission.`,
	inputSchema: submitSubReviewInputSchema,
	execute: async (input, context): Promise<ToolResult> => {
		if (!context.sessionId) {
			return {
				success: false,
				output:
					"Error: No session context - submit_sub_review requires an active session",
			};
		}

		try {
			const db = await getProjectDb(context.projectRoot);

			// Determine subtaskId from context.
			// The subtask's contextId IS the subtaskId, but ToolContext doesn't
			// have contextId directly. Query the sessions table to find the
			// contextId for this session, then use it as the subtaskId.
			const sessionRecord = await db
				.selectFrom("sessions")
				.select(["context_id"])
				.where("id", "=", context.sessionId)
				.executeTakeFirst();

			if (!sessionRecord) {
				return {
					success: false,
					output: "Error: Session not found in database",
				};
			}

			const subtaskId = sessionRecord.context_id;

			// Verify the subtask exists and is running
			const subtask = await db
				.selectFrom("subtasks")
				.selectAll()
				.where("id", "=", subtaskId)
				.executeTakeFirst();

			if (!subtask) {
				return {
					success: false,
					output: `Error: Subtask not found: ${subtaskId}`,
				};
			}

			// Store findings and mark subtask as completed
			await completeSubtask(db, subtaskId, input);

			// Check if all sibling subtasks are done
			const parentSessionId = subtask.parent_session_id;
			const status = await checkAllSubtasksDone(db, parentSessionId);

			if (status.allDone) {
				log.tools.info(
					`All subtasks done for coordinator session ${parentSessionId} — resuming coordinator`,
				);

				// Build merged findings and resume coordinator
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

					// Fire-and-forget: resume coordinator without blocking
					runner.run(coordinatorMessage).catch((err) => {
						log.tools.error(
							`Failed to resume coordinator session ${parentSessionId}: ${err instanceof Error ? err.message : "unknown error"}`,
						);
					});
				} else {
					log.tools.error(
						`Coordinator session ${parentSessionId} not found — cannot resume`,
					);
				}
			}

			return {
				success: true,
				output: "Sub-review submitted successfully.",
			};
		} catch (error) {
			return {
				success: false,
				output: `Error: Failed to submit sub-review: ${error instanceof Error ? error.message : "unknown error"}`,
			};
		}
	},
};
