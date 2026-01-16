/**
 * add_line_comment - Add a comment attached to specific line(s) in a file
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
	execute: async (_input, _context): Promise<ToolResult> => {
		return {
			success: false,
			output: "Error: Review card not found",
		};
	},
};
