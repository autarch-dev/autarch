/**
 * complete_review - Complete the review with a recommendation and summary
 */

import { z } from "zod";
import {
	REASON_DESCRIPTION,
	type ToolDefinition,
	type ToolResult,
} from "../types";

// =============================================================================
// Schema
// =============================================================================

export const completeReviewInputSchema = z.object({
	reason: z.string().describe(REASON_DESCRIPTION),
	recommendation: z
		.enum(["approve", "reject", "manual_review"])
		.describe("The recommendation: approve, reject, or manual_review"),
	summary: z
		.string()
		.min(1)
		.describe("A summary explanation for the recommendation"),
});

export type CompleteReviewInput = z.infer<typeof completeReviewInputSchema>;

// =============================================================================
// Tool Definition
// =============================================================================

export const completeReviewTool: ToolDefinition<CompleteReviewInput> = {
	name: "complete_review",
	description: `Complete the review with a recommendation and summary.
Call this tool once after adding all comments to finalize the review.
The recommendation must be one of: approve, reject, or manual_review.`,
	inputSchema: completeReviewInputSchema,
	execute: async (_input, _context): Promise<ToolResult> => {
		return {
			success: false,
			output: "Error: Review card not found",
		};
	},
};
