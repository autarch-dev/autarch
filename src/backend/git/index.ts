import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Git service for repository operations
 */

// Re-export branch operations (6 functions)
export {
	branchExists,
	createPulseBranch,
	createWorkflowBranch,
	deleteBranch,
	getCurrentBranch,
	getCurrentCommit,
} from "./branches";
// Re-export commit operations (5 functions)
export {
	commitChanges,
	createRecoveryCheckpoint,
	getChangedFiles,
	hasUncommittedChanges,
	stageAllChanges,
} from "./commits";
// Re-export diff operations (2 functions)
export { getDiff, getUncommittedDiff } from "./diffs";
// Re-export merge operations (7 functions)
export {
	fastForwardMerge,
	mergeCommit,
	mergePulseBranch,
	mergeWorkflowBranch,
	rebaseMerge,
	squashMerge,
} from "./merges";
// Re-export types
export type { GitResult, MergeStrategy, WorktreeInfo } from "./types";
// Re-export worktree operations (9 functions)
export {
	checkoutInWorktree,
	cleanupWorkflow,
	createWorktree,
	getWorktreePath,
	getWorktreesDir,
	listWorktrees,
	pruneWorktrees,
	removeWorktree,
	resetWorktree,
} from "./worktrees";

/**
 * Find the root directory of a git repository by walking up the directory tree.
 *
 * @param dir - The directory to start searching from
 * @returns The path to the repository root (the directory containing .git)
 * @throws Error if no git repository is found in the directory tree
 *
 * @example
 * const repoRoot = findRepoRoot("/home/user/project/src/components");
 * // Returns: "/home/user/project" (where .git exists)
 *
 * @example
 * const noRepo = findRepoRoot("/tmp/random");
 * // Throws: Error("Not a git repository (or any parent up to root)")
 */
export function findRepoRoot(dir: string): string {
	let currentDir = dir;

	while (true) {
		const gitPath = join(currentDir, ".git");

		// Check if .git exists (can be a directory or a file for worktrees/submodules)
		if (existsSync(gitPath)) {
			return currentDir;
		}

		// Get the parent directory
		const parentDir = dirname(currentDir);

		// Check if we've reached the filesystem root
		if (parentDir === currentDir) {
			throw new Error("Not a git repository (or any parent up to root)");
		}

		currentDir = parentDir;
	}
}
