/**
 * multi_edit - Apply multiple exact string replacements to a file atomically
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

const editOperationSchema = z.object({
	oldString: z.string().describe("Exact content to match"),
	newString: z.string().describe("Replacement content"),
	replaceAll: z
		.boolean()
		.optional()
		.default(false)
		.describe("If true, replaces all occurrences (default: false)"),
});

export const multiEditInputSchema = z.object({
	reason: z.string().describe(REASON_DESCRIPTION),
	path: z.string().describe("Path to file, relative to worktree root"),
	edits: z
		.array(editOperationSchema)
		.min(1)
		.describe(
			"Array of edit operations to apply sequentially. Each edit has: oldString (exact content to match), newString (replacement content), replaceAll (optional, if true replaces all occurrences)",
		),
});

export type MultiEditInput = z.infer<typeof multiEditInputSchema>;

export interface MultiEditOutput {
	success: boolean;
	edits_applied: number;
}

// =============================================================================
// Tool Definition
// =============================================================================

export const multiEditTool: ToolDefinition<MultiEditInput, MultiEditOutput> = {
	name: "multi_edit",
	description: `Apply **multiple exact string replacements** to a single file atomically.
More efficient than multiple edit_file calls when making several changes to the same file.

Edits are applied sequentially in array order, each operating on the result of the previous edit.
This allows overlapping or adjacent edits to work correctly.

All edits are validated before any are applied. If any edit fails validation:
- No changes are written to the file
- The tool reports which edit failed and why

Rules:
- You must read the target file with read_file before editing.
- Each oldString must match the file content exactly (at the time that edit is applied).
- Line number prefixes from read_file output must not be included in oldString or newString.
- Each edit has its own replaceAll parameter.

Failure is final: do not attempt fuzzy matching or retries.
Note: You are working in an isolated git worktree. Changes are isolated until pulse completion.`,
	inputSchema: multiEditInputSchema,
	execute: async (input, context): Promise<ToolResult<MultiEditOutput>> => {
		// TODO: Implement multi-edit
		// - Read file from context.worktreePath
		// - Apply edits sequentially
		// - Fail atomically if any edit fails

		if (input.edits.length === 0) {
			return {
				success: false,
				error: "No edits provided",
			};
		}

		return {
			success: false,
			error: `File not found: ${input.path}`,
		};
	},
};
