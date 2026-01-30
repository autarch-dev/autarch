/**
 * Diff Operations Module
 *
 * Provides functions for getting git diffs between commits/branches
 * and for uncommitted changes in worktrees.
 */

import { execGitOrThrow } from "./git-executor";

// =============================================================================
// Diff Operations
// =============================================================================

/**
 * Get the diff between two commits or branches
 */
export async function getDiff(
	repoRoot: string,
	base: string,
	head: string,
): Promise<string> {
	return execGitOrThrow(["diff", `${base}...${head}`], { cwd: repoRoot });
}

/**
 * Get the diff of uncommitted changes in a worktree
 */
export async function getUncommittedDiff(
	worktreePath: string,
): Promise<string> {
	// Include both staged and unstaged changes
	const staged = await execGitOrThrow(["diff", "--cached"], {
		cwd: worktreePath,
	});
	const unstaged = await execGitOrThrow(["diff"], { cwd: worktreePath });

	return [staged, unstaged].filter((d) => d.length > 0).join("\n");
}
