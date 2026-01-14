/**
 * add_file_comment - Add a comment attached to a file as a whole
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

export const addFileCommentTool: ToolDefinition<
	AddFileCommentInput,
	AddCommentOutput
> = {
	name: "add_file_comment",
	description: `Add a comment attached to a file as a whole.
Use this to provide feedback about a file that isn't tied to specific lines.`,
	inputSchema: addFileCommentInputSchema,
	execute: async (_input, _context): Promise<ToolResult<AddCommentOutput>> => {
		return {
			success: false,
			error: "Review card not found",
		};
	},
};
