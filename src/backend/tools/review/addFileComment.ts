/**
 * add_file_comment - Add a comment attached to a file as a whole
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

export const addFileCommentInputSchema = z.object({
	reason: z.string().describe(REASON_DESCRIPTION),
	file_path: z.string().describe("The file path this comment applies to"),
	severity: z
		.enum(["High", "Medium", "Low"])
		.describe("The severity level: High, Medium, or Low"),
	category: z.string().describe("The category of the comment"),
	description: z.string().describe("The description/content of the comment"),
});

export type AddFileCommentInput = z.infer<typeof addFileCommentInputSchema>;

// =============================================================================
// Tool Definition
// =============================================================================

export const addFileCommentTool: ToolDefinition<AddFileCommentInput> = {
	name: "add_file_comment",
	description: `Add a comment attached to a file as a whole.
Use this to provide feedback about a file that isn't tied to specific lines.`,
	inputSchema: addFileCommentInputSchema,
	execute: async (input, context): Promise<ToolResult> => {
		// Validate we have required context
		if (!context.workflowId) {
			return {
				success: false,
				output: "Error: add_file_comment requires a workflow context",
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
				type: "file",
				filePath: input.file_path,
				severity: input.severity,
				category: input.category,
				description: input.description,
			});

			return {
				success: true,
				output: `Comment added: ${comment.id}\nFile: ${input.file_path}\nSeverity: ${input.severity}\nCategory: ${input.category}`,
			};
		} catch (error) {
			return {
				success: false,
				output: `Error: ${error instanceof Error ? error.message : "Failed to add file comment"}`,
			};
		}
	},
};
