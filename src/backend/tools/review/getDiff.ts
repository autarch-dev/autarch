/**
 * get_diff - Retrieve the diff content for the current review
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

export const getDiffInputSchema = z.object({
	reason: z.string().describe(REASON_DESCRIPTION),
});

export type GetDiffInput = z.infer<typeof getDiffInputSchema>;

export interface GetDiffOutput {
	success: boolean;
	diff: string;
}

// =============================================================================
// Tool Definition
// =============================================================================

export const getDiffTool: ToolDefinition<GetDiffInput, GetDiffOutput> = {
	name: "get_diff",
	description: `Retrieve the diff content for the current review.
Returns the unified diff showing all changes made during the workflow.
Use this to analyze what was changed before submitting your review summary.`,
	inputSchema: getDiffInputSchema,
	execute: async (_input, _context): Promise<ToolResult<GetDiffOutput>> => {
		return {
			success: false,
			error: "Diff artifact not found",
		};
	},
};
