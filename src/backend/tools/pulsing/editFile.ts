/**
 * edit_file - Apply exact string replacement in a file
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

export const editFileInputSchema = z.object({
	reason: z.string().describe(REASON_DESCRIPTION),
	path: z.string().describe("Path to file, relative to worktree root"),
	oldString: z
		.string()
		.describe(
			"Exact content to match in the file (must be found as-is, including whitespace and indentation)",
		),
	newString: z
		.string()
		.describe(
			"Replacement content for the matched string (must preserve intended indentation and structure)",
		),
	replaceAll: z
		.boolean()
		.optional()
		.default(false)
		.describe(
			"If true, replaces all occurrences of oldString; otherwise, fails if multiple matches are found",
		),
});

export type EditFileInput = z.infer<typeof editFileInputSchema>;

export interface EditFileOutput {
	success: boolean;
}

// =============================================================================
// Tool Definition
// =============================================================================

export const editFileTool: ToolDefinition<EditFileInput, EditFileOutput> = {
	name: "edit_file",
	description: `Apply an **exact string replacement** in files within the worktree.
Supports single-instance replacements (oldString → newString) and multi-instance replacements via replaceAll.

Edits are applied atomically: if any replacement fails (e.g., oldString not found or multiple matches when replaceAll is not set), no changes are applied and the tool reports a hard failure.

Rules:
- You must read the target file with read_file before editing.
- The oldString must match the file content exactly, including indentation, whitespace, and line endings.
- Line number prefixes from read_file output must not be included in oldString or newString.

Failure is final: do not attempt fuzzy matching or retries.
Note: You are working in an isolated git worktree. Changes are isolated until pulse completion.`,
	inputSchema: editFileInputSchema,
	execute: async (input, context): Promise<ToolResult<EditFileOutput>> => {
		// TODO: Implement exact string replacement
		// - Read file from context.worktreePath
		// - Find oldString (validate uniqueness unless replaceAll)
		// - Perform replacement atomically
		// - Track changes for review

		return {
			success: false,
			error: `File not found: ${input.path}`,
		};
	},
};
