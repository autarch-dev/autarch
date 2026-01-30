/**
 * Branch Operations
 *
 * Functions for managing git branches: creating, checking, and deleting
 * workflow and pulse branches.
 */

import { log } from "@/backend/logger";
import { execGit, execGitOrThrow } from "./git-executor";
import { BRANCH_PREFIX } from "./types";

// =============================================================================
// Branch Operations
// =============================================================================

/**
 * Get the current branch name
 */
export async function getCurrentBranch(repoRoot: string): Promise<string> {
	return execGitOrThrow(["rev-parse", "--abbrev-ref", "HEAD"], {
		cwd: repoRoot,
	});
}

/**
 * Get the current commit SHA
 */
export async function getCurrentCommit(repoRoot: string): Promise<string> {
	return execGitOrThrow(["rev-parse", "HEAD"], { cwd: repoRoot });
}

/**
 * Check if a branch exists
 */
export async function branchExists(
	repoRoot: string,
	branchName: string,
): Promise<boolean> {
	const result = await execGit(
		["show-ref", "--verify", "--quiet", `refs/heads/${branchName}`],
		{ cwd: repoRoot },
	);
	return result.success;
}

/**
 * Create a workflow branch off the current HEAD
 *
 * @param repoRoot - Path to the git repository
 * @param workflowId - The workflow ID (used in branch name)
 * @param baseBranch - Optional base branch (defaults to current branch)
 * @returns The created branch name
 */
export async function createWorkflowBranch(
	repoRoot: string,
	workflowId: string,
	baseBranch?: string,
): Promise<string> {
	const branchName = `${BRANCH_PREFIX}/${workflowId}`;

	// If base branch specified, checkout it first
	if (baseBranch) {
		await execGitOrThrow(["checkout", baseBranch], { cwd: repoRoot });
	}

	// Check if branch already exists
	if (await branchExists(repoRoot, branchName)) {
		log.git.warn(`Workflow branch ${branchName} already exists`);
		return branchName;
	}

	// Create the branch
	await execGitOrThrow(["branch", branchName], { cwd: repoRoot });
	log.git.info(`Created workflow branch: ${branchName}`);

	return branchName;
}

/**
 * Create a pulse branch off the workflow branch
 *
 * @param repoRoot - Path to the git repository
 * @param workflowBranch - The workflow branch name
 * @param pulseId - The pulse ID (used in branch name)
 * @returns The created branch name
 */
export async function createPulseBranch(
	repoRoot: string,
	workflowBranch: string,
	pulseId: string,
): Promise<string> {
	// Use dash instead of slash to avoid Git ref hierarchy conflict
	// (Git can't have both 'foo' and 'foo/bar' as branch names)
	const branchName = `${workflowBranch}-${pulseId}`;

	// Create branch from workflow branch
	await execGitOrThrow(["branch", branchName, workflowBranch], {
		cwd: repoRoot,
	});
	log.git.info(`Created pulse branch: ${branchName}`);

	return branchName;
}

/**
 * Delete a branch
 */
export async function deleteBranch(
	repoRoot: string,
	branchName: string,
	force = false,
): Promise<void> {
	const flag = force ? "-D" : "-d";
	await execGitOrThrow(["branch", flag, branchName], { cwd: repoRoot });
	log.git.info(`Deleted branch: ${branchName}`);
}
