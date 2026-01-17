/**
 * shell - Execute a shell command in the worktree
 */

import { z } from "zod";
import { log } from "@/backend/logger";
import { getEffectiveRoot } from "../base/utils";
import {
	REASON_DESCRIPTION,
	type ToolDefinition,
	type ToolResult,
} from "../types";

// =============================================================================
// Constants
// =============================================================================

/** Maximum output size before truncation */
const MAX_OUTPUT_SIZE = 64 * 1024; // 64KB

/** Truncation message */
const TRUNCATION_MSG = "\n... [output truncated] ...";

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

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Truncate output if it exceeds max size
 */
function truncateOutput(output: string, maxSize: number): string {
	if (output.length <= maxSize) {
		return output;
	}
	return output.slice(0, maxSize - TRUNCATION_MSG.length) + TRUNCATION_MSG;
}

/**
 * Get the shell command args for the current platform
 */
function getShellArgs(command: string): string[] {
	if (process.platform === "win32") {
		return ["cmd", "/c", command];
	}
	return ["sh", "-c", command];
}

// =============================================================================
// Tool Definition
// =============================================================================

export const shellTool: ToolDefinition<ShellInput> = {
	name: "shell",
	description: `Execute a shell command in the worktree directory.
Returns stdout, stderr, and exit code.
Commands time out after 60 seconds by default.

Note: You are working in an isolated git worktree. All commands run in that context.

WARNING: Shell commands can have side effects. Use with caution.
If you have other tools that can accomplish the same thing, use them instead.`,
	inputSchema: shellInputSchema,
	execute: async (input, context): Promise<ToolResult> => {
		// Use worktree path if available (for pulsing agent isolation)
		const cwd = getEffectiveRoot(context);
		const timeout = (input.timeoutSeconds ?? 60) * 1000;

		log.tools.info(`shell: ${input.command} (cwd: ${cwd})`);

		try {
			// Create abort controller for timeout
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), timeout);

			// Spawn the process (platform-aware shell)
			const proc = Bun.spawn(getShellArgs(input.command), {
				cwd,
				stdout: "pipe",
				stderr: "pipe",
				env: process.env,
			});

			// Wait for process with timeout
			const exitPromise = proc.exited;
			const timeoutPromise = new Promise<never>((_, reject) => {
				controller.signal.addEventListener("abort", () => {
					proc.kill();
					reject(
						new Error(
							`Command timed out after ${input.timeoutSeconds} seconds`,
						),
					);
				});
			});

			let exitCode: number;
			let stdout: string;
			let stderr: string;

			try {
				// Race between completion and timeout
				const [stdoutText, stderrText, code] = await Promise.race([
					Promise.all([
						new Response(proc.stdout).text(),
						new Response(proc.stderr).text(),
						exitPromise,
					]),
					timeoutPromise.then(() => {
						throw new Error("timeout");
					}),
				]);

				exitCode = code;
				stdout = truncateOutput(stdoutText, MAX_OUTPUT_SIZE);
				stderr = truncateOutput(stderrText, MAX_OUTPUT_SIZE);
			} finally {
				clearTimeout(timeoutId);
			}

			log.tools.info(`shell completed: exit=${exitCode}`);

			// Format output as plain text
			const lines: string[] = [];
			lines.push(`Exit code: ${exitCode}`);
			if (stdout.trim()) {
				lines.push("\n--- stdout ---");
				lines.push(stdout);
			}
			if (stderr.trim()) {
				lines.push("\n--- stderr ---");
				lines.push(stderr);
			}

			return {
				success: exitCode === 0,
				output: lines.join("\n"),
			};
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Command execution failed";

			log.tools.error(`shell failed: ${errorMessage}`);

			return {
				success: false,
				output: `Error: ${errorMessage}`,
			};
		}
	},
};
