/**
 * add_line_comment - Add a comment attached to specific line(s) in a file
 */

import { z } from "zod";
import { getRepositories } from "@/backend/repositories";
import {
	REASON_DESCRIPTION,
	type ToolDefinition,
	type ToolResult,
} from "../types";

// =============================================================================
// Schema
// =============================================================================

export const addLineCommentInputSchema = z.object({
	reason: z.string().describe(REASON_DESCRIPTION),
	file_path: z.string().describe("The file path this comment applies to"),
	start_line: z
		.number()
		.int()
		.positive()
		.describe("The starting line number for the comment"),
	severity: z
		.enum(["High", "Medium", "Low"])
		.describe("The severity level: High, Medium, or Low"),
	category: z
		.string()
		.describe(
			"The category of the comment (e.g., security, performance, style, bug, architecture)",
		),
	description: z.string().describe("The description/content of the comment"),
	end_line: z
		.number()
		.int()
		.positive()
		.optional()
		.describe(
			"The ending line number (inclusive). Omit for single-line comments.",
		),
});

export type AddLineCommentInput = z.infer<typeof addLineCommentInputSchema>;

// =============================================================================
// Tool Definition
// =============================================================================

export const addLineCommentTool: ToolDefinition<AddLineCommentInput> = {
	name: "add_line_comment",
	description: `Add a comment attached to specific line(s) in a file.
Use this to provide feedback on specific code changes in the diff.`,
	inputSchema: addLineCommentInputSchema,
	execute: async (input, context): Promise<ToolResult> => {
		// Validate we have required context
		if (!context.workflowId) {
			return {
				success: false,
				output: "Error: add_line_comment requires a workflow context",
			};
		}

		// Validate end_line if provided
		if (input.end_line !== undefined && input.end_line < input.start_line) {
			return {
				success: false,
				output: `Error: end_line (${input.end_line}) must be >= start_line (${input.start_line})`,
			};
		}

		try {
			const { artifacts } = getRepositories();

			// Get the current review card for this workflow
			const reviewCard = await artifacts.getLatestReviewCard(
				context.workflowId,
			);
			if (!reviewCard) {
				return {
					success: false,
					output: "Error: No review card found for this workflow",
				};
			}

			// Insert the comment into the database immediately
			const comment = await artifacts.createReviewComment({
				reviewCardId: reviewCard.id,
				type: "line",
				filePath: input.file_path,
				startLine: input.start_line,
				endLine: input.end_line,
				severity: input.severity,
				category: input.category,
				description: input.description,
			});

			const lineRange =
				input.end_line && input.end_line !== input.start_line
					? `lines ${input.start_line}-${input.end_line}`
					: `line ${input.start_line}`;

			return {
				success: true,
				output: `Comment added: ${comment.id}\nFile: ${input.file_path} (${lineRange})\nSeverity: ${input.severity}\nCategory: ${input.category}`,
			};
		} catch (error) {
			return {
				success: false,
				output: `Error: ${error instanceof Error ? error.message : "Failed to add line comment"}`,
			};
		}
	},
};
