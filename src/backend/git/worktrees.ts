/**
 * Worktree Operations
 *
 * Functions for managing git worktrees: creating, listing, removing,
 * and cleaning up worktrees for isolated workflow execution.
 */

import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { log } from "@/backend/logger";
import { deleteBranch } from "./branches";
import { execGitOrThrow } from "./git-executor";
import { BRANCH_PREFIX, WORKTREES_DIR, type WorktreeInfo } from "./types";

// =============================================================================
// Worktree Operations
// =============================================================================

/**
 * Get the worktrees directory path
 */
export function getWorktreesDir(projectRoot: string): string {
	return join(projectRoot, ".autarch", WORKTREES_DIR);
}

/**
 * Get the worktree path for a workflow
 */
export function getWorktreePath(
	projectRoot: string,
	workflowId: string,
): string {
	return join(getWorktreesDir(projectRoot), workflowId);
}

/**
 * List all worktrees
 */
export async function listWorktrees(repoRoot: string): Promise<WorktreeInfo[]> {
	const output = await execGitOrThrow(["worktree", "list", "--porcelain"], {
		cwd: repoRoot,
	});

	if (!output) return [];

	const worktrees: WorktreeInfo[] = [];
	let current: Partial<WorktreeInfo> = {};

	for (const line of output.split("\n")) {
		if (line.startsWith("worktree ")) {
			current.path = line.slice(9);
		} else if (line.startsWith("HEAD ")) {
			current.head = line.slice(5);
		} else if (line.startsWith("branch ")) {
			current.branch = line.slice(7).replace("refs/heads/", "");
		} else if (line === "") {
			if (current.path && current.head) {
				worktrees.push(current as WorktreeInfo);
			}
			current = {};
		}
	}

	// Handle last entry if no trailing newline
	if (current.path && current.head) {
		worktrees.push(current as WorktreeInfo);
	}

	return worktrees;
}

/**
 * Create a worktree for a workflow
 *
 * @param repoRoot - Path to the main git repository
 * @param workflowId - The workflow ID
 * @param branchName - The branch to checkout in the worktree
 * @returns Path to the created worktree
 */
export async function createWorktree(
	repoRoot: string,
	workflowId: string,
	branchName: string,
): Promise<string> {
	const worktreePath = getWorktreePath(repoRoot, workflowId);

	// Ensure worktrees directory exists
	const worktreesDir = getWorktreesDir(repoRoot);
	if (!existsSync(worktreesDir)) {
		mkdirSync(worktreesDir, { recursive: true });
	}

	// Check if worktree already exists
	if (existsSync(worktreePath)) {
		log.git.warn(`Worktree already exists at ${worktreePath}`);
		return worktreePath;
	}

	// Create the worktree
	await execGitOrThrow(["worktree", "add", worktreePath, branchName], {
		cwd: repoRoot,
	});

	log.git.info(`Created worktree at ${worktreePath} on branch ${branchName}`);
	return worktreePath;
}

/**
 * Remove a worktree
 *
 * @param repoRoot - Path to the main git repository
 * @param worktreePath - Path to the worktree to remove
 * @param force - Force removal even if there are uncommitted changes
 */
export async function removeWorktree(
	repoRoot: string,
	worktreePath: string,
	force = false,
): Promise<void> {
	const args = ["worktree", "remove"];
	if (force) args.push("--force");
	args.push(worktreePath);

	await execGitOrThrow(args, { cwd: repoRoot });
	log.git.info(`Removed worktree at ${worktreePath}`);
}

/**
 * Clean up stale worktree references
 */
export async function pruneWorktrees(repoRoot: string): Promise<void> {
	await execGitOrThrow(["worktree", "prune"], { cwd: repoRoot });
}

/**
 * Checkout a branch in a worktree
 */
export async function checkoutInWorktree(
	worktreePath: string,
	branchName: string,
): Promise<void> {
	await execGitOrThrow(["checkout", branchName], { cwd: worktreePath });
	log.git.info(`Checked out ${branchName} in worktree ${worktreePath}`);
}

/**
 * Reset worktree to a branch HEAD (discarding uncommitted changes)
 */
export async function resetWorktree(
	worktreePath: string,
	branchName: string,
): Promise<void> {
	await execGitOrThrow(["checkout", branchName], { cwd: worktreePath });
	await execGitOrThrow(["reset", "--hard", branchName], { cwd: worktreePath });
	await execGitOrThrow(["clean", "-fd"], { cwd: worktreePath });
	log.git.info(`Reset worktree ${worktreePath} to ${branchName}`);
}

// =============================================================================
// Cleanup
// =============================================================================

/**
 * Clean up all resources for a workflow
 *
 * Removes the worktree and optionally the workflow branch.
 * Uses a fallback pattern for cleanup: tries git worktree remove first,
 * on failure uses rmSync + pruneWorktrees. Branch deletion happens in
 * finally block to ensure cleanup continues even on errors.
 */
export async function cleanupWorkflow(
	repoRoot: string,
	workflowId: string,
	options: { deleteBranch?: boolean } = {},
): Promise<void> {
	const worktreePath = getWorktreePath(repoRoot, workflowId);
	const workflowBranch = `${BRANCH_PREFIX}/${workflowId}`;

	try {
		// Remove worktree if it exists
		if (existsSync(worktreePath)) {
			try {
				await removeWorktree(repoRoot, worktreePath, true);
			} catch {
				// If git worktree remove fails, try manual cleanup
				log.git.warn(`Git worktree remove failed, attempting manual cleanup`);
				rmSync(worktreePath, { recursive: true, force: true });
				await pruneWorktrees(repoRoot);
			}
		}
	} finally {
		// Delete branch if requested - in finally to ensure it runs even on worktree errors
		if (options.deleteBranch) {
			try {
				await deleteBranch(repoRoot, workflowBranch, true);
			} catch {
				log.git.warn(`Could not delete branch ${workflowBranch}`);
			}
		}

		log.git.info(`Cleaned up workflow ${workflowId}`);
	}
}
