/**
 * add_review_comment - Add a comment attached to the overall review
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

export const addReviewCommentInputSchema = z.object({
	reason: z.string().describe(REASON_DESCRIPTION),
	severity: z
		.enum(["High", "Medium", "Low"])
		.describe("The severity level: High, Medium, or Low"),
	category: z.string().describe("The category of the comment"),
	description: z.string().describe("The description/content of the comment"),
});

export type AddReviewCommentInput = z.infer<typeof addReviewCommentInputSchema>;

// =============================================================================
// Tool Definition
// =============================================================================

export const addReviewCommentTool: ToolDefinition<AddReviewCommentInput> = {
	name: "add_review_comment",
	description: `Add a comment attached to the overall review.
Use this for general observations or feedback not tied to specific files or lines.`,
	inputSchema: addReviewCommentInputSchema,
	execute: async (input, context): Promise<ToolResult> => {
		// Validate we have required context
		if (!context.workflowId) {
			return {
				success: false,
				output: "Error: add_review_comment requires a workflow context",
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
				type: "review",
				severity: input.severity,
				category: input.category,
				description: input.description,
			});

			return {
				success: true,
				output: `Comment added: ${comment.id}\nSeverity: ${input.severity}\nCategory: ${input.category}`,
			};
		} catch (error) {
			return {
				success: false,
				output: `Error: ${error instanceof Error ? error.message : "Failed to add review comment"}`,
			};
		}
	},
};
