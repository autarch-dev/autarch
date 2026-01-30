/**
 * Git Executor - Foundation module for git operations
 *
 * Provides low-level git command execution. All other git modules
 * depend on this foundation layer.
 */

import type { GitResult } from "./types";

// =============================================================================
// Low-level Git Operations
// =============================================================================

/**
 * Execute a git command and return the result
 */
export async function execGit(
	args: string[],
	options: { cwd?: string; env?: Record<string, string> } = {},
): Promise<GitResult> {
	const proc = Bun.spawn(["git", ...args], {
		cwd: options.cwd,
		env: { ...process.env, ...options.env },
		stdout: "pipe",
		stderr: "pipe",
	});

	const [stdout, stderr] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
	]);

	const exitCode = await proc.exited;

	return {
		success: exitCode === 0,
		stdout: stdout.trim(),
		stderr: stderr.trim(),
		exitCode,
	};
}

/**
 * Execute a git command, throwing on failure
 */
export async function execGitOrThrow(
	args: string[],
	options: { cwd?: string; env?: Record<string, string> } = {},
): Promise<string> {
	const result = await execGit(args, options);
	if (!result.success) {
		throw new Error(
			`Git command failed: git ${args.join(" ")}\n${result.stderr}`,
		);
	}
	return result.stdout;
}
