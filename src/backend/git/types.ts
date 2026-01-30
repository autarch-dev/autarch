/**
 * Shared types and constants for git operations
 */

// =============================================================================
// Types
// =============================================================================

export interface WorktreeInfo {
	path: string;
	branch: string;
	head: string;
}

export interface GitResult {
	success: boolean;
	stdout: string;
	stderr: string;
	exitCode: number;
}

/** Merge strategy for combining workflow branches */
export type MergeStrategy =
	| "fast-forward"
	| "squash"
	| "merge-commit"
	| "rebase";

// =============================================================================
// Constants
// =============================================================================

/** Directory within .autarch where worktrees are stored */
export const WORKTREES_DIR = "worktrees";

/** Branch prefix for all Autarch-managed branches */
export const BRANCH_PREFIX = "autarch";
