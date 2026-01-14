/**
 * add_review_comment - Add a comment attached to the overall review
 */

import { z } from "zod";
import {
	REASON_DESCRIPTION,
	type ToolDefinition,
	type ToolResult,
} from "../types";
import type { AddCommentOutput } from "./addLineComment";

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

export const addReviewCommentTool: ToolDefinition<
	AddReviewCommentInput,
	AddCommentOutput
> = {
	name: "add_review_comment",
	description: `Add a comment attached to the overall review.
Use this for general observations or feedback not tied to specific files or lines.`,
	inputSchema: addReviewCommentInputSchema,
	execute: async (_input, _context): Promise<ToolResult<AddCommentOutput>> => {
		return {
			success: false,
			error: "Review card not found",
		};
	},
};
