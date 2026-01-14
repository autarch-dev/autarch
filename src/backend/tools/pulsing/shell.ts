/**
 * shell - Execute a shell command in the worktree
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

export const shellInputSchema = z.object({
	reason: z.string().describe(REASON_DESCRIPTION),
	command: z.string().describe("Shell command to execute"),
	timeoutSeconds: z
		.number()
		.int()
		.positive()
		.max(300)
		.optional()
		.default(60)
		.describe("Timeout in seconds (default: 60, max: 300)"),
});

export type ShellInput = z.infer<typeof shellInputSchema>;

export interface ShellOutput {
	success: boolean;
	exit_code?: number;
	stdout?: string;
	stderr?: string;
	error?: string;
}

// =============================================================================
// Tool Definition
// =============================================================================

export const shellTool: ToolDefinition<ShellInput, ShellOutput> = {
	name: "shell",
	description: `Execute a shell command in the worktree directory.
Returns stdout, stderr, and exit code.
Commands time out after 60 seconds.

Note: You are working in an isolated git worktree. All commands run in that context.

WARNING: Shell commands can have side effects. Use with caution.
If you have other tools that can accomplish the same thing, use them instead.`,
	inputSchema: shellInputSchema,
	execute: async (input, context): Promise<ToolResult<ShellOutput>> => {
		// TODO: Implement shell execution
		// - Run in context.worktreePath
		// - Apply timeout
		// - Truncate output if too large
		// - Gate sensitive output

		return {
			success: false,
			error: "shell not implemented",
		};
	},
};
