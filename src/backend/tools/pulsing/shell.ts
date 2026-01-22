/**
 * shell - Execute a shell command in the worktree
 */

import { z } from "zod";
import { log } from "@/backend/logger";
import { shellApprovalService } from "@/backend/services/shell-approval";
import { getEffectiveRoot } from "../base/utils";
import {
	REASON_DESCRIPTION,
	type ToolDefinition,
	type ToolResult,
} from "../types";

// =============================================================================
// Constants
// =============================================================================

/** Maximum output size when full_output is true */
const FULL_OUTPUT_SIZE = 64 * 1024; // 64KB

/** Default output size for truncated output */
const DEFAULT_OUTPUT_SIZE = 4 * 1024; // 4KB

/** Size of head portion to preserve when truncating */
const HEAD_SIZE = 1024; // 1KB

/** Size of tail portion to preserve when truncating */
const TAIL_SIZE = 3072; // 3KB

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
	full_output: z
		.boolean()
		.optional()
		.default(false)
		.describe(
			"If true, returns up to 64KB of output. Default: truncates to 4KB (1KB head + 3KB tail) with omission notice.",
		),
});

export type ShellInput = z.infer<typeof shellInputSchema>;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Format byte count for display (KB with one decimal for >= 1024, bytes otherwise)
 */
function formatBytes(bytes: number): string {
	if (bytes >= 1024) {
		return `${(bytes / 1024).toFixed(1)}KB`;
	}
	return `${bytes} bytes`;
}

/**
 * Truncate output using head+tail strategy if it exceeds max size.
 * Uses HEAD_SIZE:TAIL_SIZE ratio (1:3) scaled to maxSize for truncation bounds.
 */
function truncateOutput(output: string, maxSize: number): string {
	if (output.length <= maxSize) {
		return output;
	}
	// Scale head/tail sizes proportionally to maxSize, maintaining 1:3 ratio
	const totalParts = HEAD_SIZE + TAIL_SIZE; // 4KB
	const headSize = Math.floor((HEAD_SIZE / totalParts) * maxSize);
	const tailSize = maxSize - headSize;

	const omittedBytes = output.length - headSize - tailSize;
	const omissionMsg = `\n... [${formatBytes(omittedBytes)} omitted] ...\n`;
	return output.slice(0, headSize) + omissionMsg + output.slice(-tailSize);
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

Output is truncated to 4KB by default (preserving first 1KB and last 3KB). Use full_output: true to return up to 64KB.

Note: You are working in an isolated git worktree. All commands run in that context.
The current working directory is already set to the worktree root.

WARNING: Shell commands can have side effects. Use with caution.
If you have other tools that can accomplish the same thing, use them instead.`,
	inputSchema: shellInputSchema,
	execute: async (input, context): Promise<ToolResult> => {
		// Use worktree path if available (for pulsing agent isolation)
		const cwd = getEffectiveRoot(context);
		const timeout = (input.timeoutSeconds ?? 60) * 1000;

		// Check for approval if we have workflow context
		const { workflowId, sessionId, turnId, toolCallId } = context;

		if (workflowId && sessionId && turnId) {
			// Check if command is remembered (auto-approved)
			if (
				!shellApprovalService.isCommandRemembered(workflowId, input.command)
			) {
				// Request approval and wait for user decision
				try {
					const effectiveToolId = toolCallId ?? crypto.randomUUID();
					log.tools.info(`Shell requesting approval with toolCallId: ${toolCallId}, effectiveToolId: ${effectiveToolId}`);
					const approvalResult = await shellApprovalService.requestApproval({
						workflowId,
						sessionId,
						turnId,
						toolId: effectiveToolId,
						command: input.command,
						reason: input.reason,
					});

					if (!approvalResult.approved) {
						const reason = approvalResult.denyReason
							? `Command denied by user: ${approvalResult.denyReason}. Please try an alternative approach.`
							: "Command denied by user. Please try an alternative approach.";
						return {
							success: false,
							output: reason,
						};
					}
				} catch (error) {
					// Handle approval service errors (e.g., session cleanup during pending approval)
					const errorMessage =
						error instanceof Error ? error.message : "Approval request failed";
					log.tools.info(`Shell approval error: ${errorMessage}`);
					return {
						success: false,
						output: `Command not executed: ${errorMessage}`,
					};
				}
			}
		}
		// If any context fields are missing (e.g., channel context), proceed without approval

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
				stdout = stdoutText;
				stderr = stderrText;
			} finally {
				clearTimeout(timeoutId);
			}

			log.tools.info(`shell completed: exit=${exitCode}`);

			// Build combined output first
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

			// Determine max size based on full_output parameter
			const maxSize = input.full_output
				? FULL_OUTPUT_SIZE
				: DEFAULT_OUTPUT_SIZE;
			const combinedOutput = truncateOutput(lines.join("\n"), maxSize);

			return {
				success: exitCode === 0,
				output: combinedOutput,
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
