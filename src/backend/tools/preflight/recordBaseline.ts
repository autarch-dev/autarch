/**
 * record_baseline - Record a known build/lint error or warning
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

export const recordBaselineInputSchema = z.object({
	reason: z.string().describe(REASON_DESCRIPTION),
	issueType: z
		.enum(["error", "warning"])
		.describe("Type of issue: 'error' or 'warning'"),
	source: z
		.enum(["build", "lint", "test"])
		.describe("Source of the issue: 'build', 'lint', or 'test'"),
	pattern: z
		.string()
		.describe("The exact error/warning message or pattern to match"),
	filePath: z
		.string()
		.optional()
		.describe("Optional file path associated with this issue"),
	description: z
		.string()
		.optional()
		.describe("Optional description for context"),
});

export type RecordBaselineInput = z.infer<typeof recordBaselineInputSchema>;

export interface RecordBaselineOutput {
	success: boolean;
	baselineId: string;
	message: string;
}

// =============================================================================
// Tool Definition
// =============================================================================

export const recordBaselineTool: ToolDefinition<
	RecordBaselineInput,
	RecordBaselineOutput
> = {
	name: "record_baseline",
	description: `Record a known build/lint error or warning from the clean worktree state.
Agents verifying a build after making code changes will ignore these.

Use this after running build/lint commands to record any pre-existing issues
that are not caused by code changes.

Parameters:
- issueType: "error" or "warning"
- source: "build", "lint", or "test"
- pattern: The exact error/warning message or a pattern to match
- filePath: Optional file path associated with the issue
- description: Optional description for context`,
	inputSchema: recordBaselineInputSchema,
	execute: async (
		_input,
		_context,
	): Promise<ToolResult<RecordBaselineOutput>> => {
		return {
			success: false,
			error: "record_baseline not implemented",
		};
	},
};
