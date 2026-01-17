/**
 * get_diff - Retrieve the diff content for the current review
 */

import { z } from "zod";
import { getProjectDb } from "@/backend/db/project";
import { getDiff } from "@/backend/git";
import {
	REASON_DESCRIPTION,
	type ToolDefinition,
	type ToolResult,
} from "../types";

// =============================================================================
// Schema
// =============================================================================

export const getDiffInputSchema = z.object({
	reason: z.string().describe(REASON_DESCRIPTION),
});

export type GetDiffInput = z.infer<typeof getDiffInputSchema>;

// =============================================================================
// Tool Definition
// =============================================================================

export const getDiffTool: ToolDefinition<GetDiffInput> = {
	name: "get_diff",
	description: `Retrieve the diff content for the current review.
Returns the unified diff showing all changes made during the workflow.
Use this to analyze what was changed before submitting your review summary.`,
	inputSchema: getDiffInputSchema,
	execute: async (_input, context): Promise<ToolResult> => {
		// Validate workflow context
		if (!context.workflowId) {
			return {
				success: false,
				output:
					"Error: No workflow context - get_diff can only be used in workflow sessions",
			};
		}

		try {
			// Get database connection
			const db = await getProjectDb(context.projectRoot);

			// Fetch the workflow to get base_branch
			const workflow = await db
				.selectFrom("workflows")
				.select(["base_branch"])
				.where("id", "=", context.workflowId)
				.executeTakeFirst();

			if (!workflow) {
				return {
					success: false,
					output: `Error: Workflow not found: ${context.workflowId}`,
				};
			}

			if (!workflow.base_branch) {
				return {
					success: false,
					output:
						"Error: Workflow has no base_branch set - cannot compute diff",
				};
			}

			// Construct the workflow branch name (autarch/{workflowId})
			const workflowBranch = `autarch/${context.workflowId}`;

			// Get the diff between base branch and workflow branch
			const diffContent = await getDiff(
				context.projectRoot,
				workflow.base_branch,
				workflowBranch,
			);

			if (!diffContent || diffContent.trim() === "") {
				return {
					success: true,
					output:
						"No changes found - the workflow branch matches the base branch.",
				};
			}

			return {
				success: true,
				output: diffContent,
			};
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Unknown error occurred";
			return {
				success: false,
				output: `Error: Failed to get diff - ${message}`,
			};
		}
	},
};
