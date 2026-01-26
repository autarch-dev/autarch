/**
 * Git Worktree Service
 *
 * Manages git worktrees and branches for isolated pulse execution.
 * Each workflow gets its own branch and worktree where code changes happen.
 */

import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { log } from "@/backend/logger";

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
const WORKTREES_DIR = "worktrees";

/** Branch prefix for all Autarch-managed branches */
const BRANCH_PREFIX = "autarch";

// =============================================================================
// Low-level Git Operations
// =============================================================================

/**
 * Execute a git command and return the result
 */
async function execGit(
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
async function execGitOrThrow(
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
// Commit Operations
// =============================================================================

/**
 * Check if there are uncommitted changes in the worktree
 */
export async function hasUncommittedChanges(
	worktreePath: string,
): Promise<boolean> {
	const result = await execGit(["status", "--porcelain"], {
		cwd: worktreePath,
	});
	return result.stdout.length > 0;
}

/**
 * Get list of changed files in the worktree
 */
export async function getChangedFiles(worktreePath: string): Promise<string[]> {
	const output = await execGitOrThrow(["status", "--porcelain"], {
		cwd: worktreePath,
	});

	if (!output) return [];

	return output
		.split("\n")
		.filter((line) => line.length > 0)
		.map((line) => line.slice(3)); // Remove status prefix (e.g., "M  " or "?? ")
}

/**
 * Stage all changes in the worktree
 */
export async function stageAllChanges(worktreePath: string): Promise<void> {
	await execGitOrThrow(["add", "-A"], { cwd: worktreePath });
}

/**
 * Commit changes in the worktree
 *
 * @param worktreePath - Path to the worktree
 * @param message - Commit message
 * @param trailers - Optional Git trailers to append (key-value pairs)
 * @returns The commit SHA
 */
export async function commitChanges(
	worktreePath: string,
	message: string,
	trailers?: Record<string, string>,
): Promise<string> {
	// Stage all changes
	await stageAllChanges(worktreePath);

	// Check if there's anything to commit
	const hasChanges = await hasUncommittedChanges(worktreePath);
	if (!hasChanges) {
		// Nothing to commit, return current HEAD
		return getCurrentCommit(worktreePath);
	}

	// Build commit message with optional trailers
	let fullMessage = message;
	if (trailers && Object.keys(trailers).length > 0) {
		const trailerLines = Object.entries(trailers)
			.map(([key, value]) => `${key}: ${value}`)
			.join("\n");
		fullMessage = `${message}\n\n${trailerLines}`;
	}

	// Commit with Autarch identity
	await execGitOrThrow(["commit", "-m", fullMessage], {
		cwd: worktreePath,
		env: {
			GIT_AUTHOR_NAME: "Autarch",
			GIT_AUTHOR_EMAIL: "autarch@local",
			GIT_COMMITTER_NAME: "Autarch",
			GIT_COMMITTER_EMAIL: "autarch@local",
		},
	});

	const sha = await getCurrentCommit(worktreePath);
	log.git.info(`Committed changes: ${sha.slice(0, 8)} - ${message}`);
	return sha;
}

/**
 * Create a recovery checkpoint commit
 * Used to save work-in-progress when a pulse fails or is stopped
 *
 * @param worktreePath - Path to the worktree
 * @returns The commit SHA, or null if nothing to commit
 */
export async function createRecoveryCheckpoint(
	worktreePath: string,
): Promise<string | null> {
	const hasChanges = await hasUncommittedChanges(worktreePath);
	if (!hasChanges) {
		return null;
	}

	const sha = await commitChanges(
		worktreePath,
		"[RECOVERY] Work in progress checkpoint",
	);

	log.git.info(`Created recovery checkpoint: ${sha.slice(0, 8)}`);
	return sha;
}

// =============================================================================
// Merge Operations
// =============================================================================

/**
 * Fast-forward merge a branch into the current branch
 *
 * @param worktreePath - Path to the worktree (must be on target branch)
 * @param sourceBranch - Branch to merge from
 */
export async function fastForwardMerge(
	worktreePath: string,
	sourceBranch: string,
): Promise<void> {
	await execGitOrThrow(["merge", "--ff-only", sourceBranch], {
		cwd: worktreePath,
	});

	log.git.info(`Fast-forward merged ${sourceBranch}`);
}

/**
 * Squash merge a branch into the current branch
 *
 * @param worktreePath - Path to the worktree (must be on target branch)
 * @param sourceBranch - Branch to merge from
 * @param commitMessage - Message for the squash commit
 */
export async function squashMerge(
	worktreePath: string,
	sourceBranch: string,
	commitMessage: string,
): Promise<void> {
	await execGitOrThrow(["merge", "--squash", sourceBranch], {
		cwd: worktreePath,
	});

	await execGitOrThrow(["commit", "-m", commitMessage], {
		cwd: worktreePath,
		env: {
			GIT_AUTHOR_NAME: "Autarch",
			GIT_AUTHOR_EMAIL: "autarch@local",
			GIT_COMMITTER_NAME: "Autarch",
			GIT_COMMITTER_EMAIL: "autarch@local",
		},
	});

	log.git.info(`Squash merged ${sourceBranch}`);
}

/**
 * Create a merge commit (no fast-forward)
 *
 * @param worktreePath - Path to the worktree (must be on target branch)
 * @param sourceBranch - Branch to merge from
 * @param commitMessage - Message for the merge commit
 */
export async function mergeCommit(
	worktreePath: string,
	sourceBranch: string,
	commitMessage: string,
): Promise<void> {
	await execGitOrThrow(
		["merge", "--no-ff", "-m", commitMessage, sourceBranch],
		{
			cwd: worktreePath,
			env: {
				GIT_AUTHOR_NAME: "Autarch",
				GIT_AUTHOR_EMAIL: "autarch@local",
				GIT_COMMITTER_NAME: "Autarch",
				GIT_COMMITTER_EMAIL: "autarch@local",
			},
		},
	);

	log.git.info(`Merge commit created for ${sourceBranch}`);
}

/**
 * Rebase merge a workflow branch onto the base branch (GitHub-style rebase and merge)
 *
 * This performs a proper "rebase and merge" operation:
 * 1. Checkout the workflow branch
 * 2. Rebase it onto the base branch
 * 3. Checkout the base branch
 * 4. Fast-forward merge the rebased workflow branch
 *
 * @param worktreePath - Path to the worktree
 * @param baseBranch - The base branch to rebase onto and merge into
 * @param workflowBranch - The workflow branch to rebase
 */
export async function rebaseMerge(
	worktreePath: string,
	baseBranch: string,
	workflowBranch: string,
): Promise<void> {
	// Step 1: Checkout workflow branch
	await checkoutInWorktree(worktreePath, workflowBranch);

	// Step 2: Rebase workflow branch onto base branch
	const result = await execGit(["rebase", baseBranch], {
		cwd: worktreePath,
	});

	if (!result.success) {
		// Abort the rebase on error
		await execGit(["rebase", "--abort"], { cwd: worktreePath });
		throw new Error(
			`Git rebase failed: git rebase ${baseBranch}\n${result.stderr}`,
		);
	}

	log.git.info(`Rebased ${workflowBranch} onto ${baseBranch}`);

	// Step 3: Checkout base branch
	await checkoutInWorktree(worktreePath, baseBranch);

	// Step 4: Fast-forward merge the rebased workflow branch
	await fastForwardMerge(worktreePath, workflowBranch);
}

/**
 * Rebase merge variant that can skip base branch checkout when not needed
 *
 * Used when the base branch is already checked out in the target worktree,
 * avoiding the Git error about branches being checked out in multiple worktrees.
 *
 * @param worktreePath - Path to the worktree where merge will happen
 * @param baseBranch - The base branch to rebase onto and merge into
 * @param workflowBranch - The workflow branch to rebase
 * @param needsBaseCheckout - Whether we need to checkout the base branch (false if already checked out)
 */
async function rebaseMergeWithWorktree(
	repoRoot: string,
	worktreePath: string,
	baseBranch: string,
	workflowBranch: string,
	needsBaseCheckout: boolean,
): Promise<void> {
	// For rebase, we need to be on the workflow branch to rebase it
	// But we can only checkout the workflow branch if it's not checked out elsewhere
	// Rebase approach: use a temporary detached HEAD to do the rebase

	// Check if workflowBranch is checked out in another worktree
	// If so, we need to detach HEAD there first to release the branch lock
	let workflowWorktreeToRestore: string | null = null;
	const detectedWorktreePath = await findWorktreeWithBranch(
		repoRoot,
		workflowBranch,
	);

	if (detectedWorktreePath !== null) {
		log.git.info(
			`Detaching HEAD in worktree at ${detectedWorktreePath} to release lock on ${workflowBranch}`,
		);
		const detachResult = await execGit(["checkout", "--detach"], {
			cwd: detectedWorktreePath,
		});

		if (!detachResult.success) {
			log.git.warn(
				`Failed to detach HEAD: ${detachResult.stderr || detachResult.stdout}`,
			);
			throw new Error(
				`Failed to detach HEAD in worktree at ${detectedWorktreePath}. Cannot proceed with rebase merge.`,
			);
		}

		workflowWorktreeToRestore = detectedWorktreePath;
	}

	try {
		if (needsBaseCheckout) {
			// Standard flow: we can freely switch branches
			// Step 1: Checkout workflow branch
			await checkoutInWorktree(worktreePath, workflowBranch);

			// Step 2: Rebase workflow branch onto base branch
			const result = await execGit(["rebase", baseBranch], {
				cwd: worktreePath,
			});

			if (!result.success) {
				await execGit(["rebase", "--abort"], { cwd: worktreePath });
				throw new Error(
					`Git rebase failed: git rebase ${baseBranch}\n${result.stderr}`,
				);
			}

			log.git.info(`Rebased ${workflowBranch} onto ${baseBranch}`);

			// Step 3: Checkout base branch
			await checkoutInWorktree(worktreePath, baseBranch);

			// Step 4: Fast-forward merge the rebased workflow branch
			await fastForwardMerge(worktreePath, workflowBranch);
		} else {
			// We're in a worktree where baseBranch is already checked out
			// We need to do the rebase without checking out workflowBranch (it may be in another worktree)

			// Use git rebase with explicit refs instead of checkout
			// This is equivalent to: git checkout workflowBranch && git rebase baseBranch
			// After this command, HEAD will be on workflowBranch (rebased)
			const result = await execGit(["rebase", baseBranch, workflowBranch], {
				cwd: worktreePath,
			});

			if (!result.success) {
				await execGit(["rebase", "--abort"], { cwd: worktreePath });
				throw new Error(
					`Git rebase failed: git rebase ${baseBranch} ${workflowBranch}\n${result.stderr}`,
				);
			}

			log.git.info(`Rebased ${workflowBranch} onto ${baseBranch}`);

			// After rebase, we're on workflowBranch - need to checkout baseBranch for the merge
			await checkoutInWorktree(worktreePath, baseBranch);

			// Now fast-forward merge workflowBranch into baseBranch
			await fastForwardMerge(worktreePath, workflowBranch);
		}
	} finally {
		// Restore the workflow branch checkout in the worktree where we detached HEAD
		// This is a best-effort cleanup - we log failures instead of throwing to avoid
		// masking the original error if we're in an error path
		if (workflowWorktreeToRestore !== null) {
			const restoreResult = await execGit(["checkout", workflowBranch], {
				cwd: workflowWorktreeToRestore,
			});
			if (!restoreResult.success) {
				log.git.error(
					`Failed to restore branch ${workflowBranch} in worktree at ${workflowWorktreeToRestore}: ${restoreResult.stderr || restoreResult.stdout}`,
				);
			}
		}
	}
}

/**
 * Find if a branch is checked out in any worktree and return that worktree's path if so
 *
 * @param repoRoot - Path to the main repository
 * @param branchName - The branch to look for
 * @returns The worktree path where the branch is checked out, or null if not found
 */
async function findWorktreeWithBranch(
	repoRoot: string,
	branchName: string,
): Promise<string | null> {
	const worktrees = await listWorktrees(repoRoot);
	for (const wt of worktrees) {
		if (wt.branch === branchName) {
			return wt.path;
		}
	}
	return null;
}

/**
 * Merge a workflow branch into the base branch using the specified strategy
 *
 * If the base branch is already checked out in another worktree (e.g., the main worktree),
 * the merge will be performed there instead, avoiding the Git error about branches being
 * checked out in multiple worktrees.
 *
 * @param repoRoot - Path to the main repository
 * @param worktreePath - Path to the worktree
 * @param baseBranch - The base branch to merge into
 * @param workflowBranch - The workflow branch to merge from
 * @param strategy - The merge strategy to use
 * @param commitMessage - Message for the commit (used by squash and merge-commit strategies)
 */
export async function mergeWorkflowBranch(
	repoRoot: string,
	worktreePath: string,
	baseBranch: string,
	workflowBranch: string,
	strategy: MergeStrategy,
	commitMessage: string,
): Promise<void> {
	// Check if baseBranch is already checked out in another worktree
	const existingWorktree = await findWorktreeWithBranch(repoRoot, baseBranch);

	// Determine where to perform the merge
	let mergePath: string;
	let needsCheckout: boolean;

	if (existingWorktree && existingWorktree !== worktreePath) {
		// baseBranch is checked out in another worktree (likely the main worktree)
		// Check if it has uncommitted changes
		const hasChanges = await hasUncommittedChanges(existingWorktree);
		if (hasChanges) {
			throw new Error(
				"Cannot merge: your working directory has uncommitted changes. Please commit or stash your changes first, then retry.",
			);
		}

		// Use the existing worktree for the merge (baseBranch is already checked out)
		mergePath = existingWorktree;
		needsCheckout = false;
		log.git.info(
			`Base branch ${baseBranch} is checked out at ${existingWorktree}, performing merge there`,
		);
	} else {
		// baseBranch is not checked out elsewhere, use the workflow worktree
		mergePath = worktreePath;
		needsCheckout = true;
	}

	// For rebase strategy, we handle checkout differently (workflow branch first)
	// For all other strategies, checkout base branch first (if needed)
	if (strategy === "rebase") {
		// rebaseMerge handles its own checkout sequence
		// Pass needsCheckout to indicate if base branch checkout is safe
		await rebaseMergeWithWorktree(
			repoRoot,
			mergePath,
			baseBranch,
			workflowBranch,
			needsCheckout,
		);
	} else {
		// Checkout base branch in worktree (only if needed)
		if (needsCheckout) {
			await checkoutInWorktree(mergePath, baseBranch);
		}

		// Execute merge based on strategy
		switch (strategy) {
			case "fast-forward":
				await fastForwardMerge(mergePath, workflowBranch);
				break;
			case "squash":
				await squashMerge(mergePath, workflowBranch, commitMessage);
				break;
			case "merge-commit":
				await mergeCommit(mergePath, workflowBranch, commitMessage);
				break;
			default: {
				const _exhaustive: never = strategy;
				throw new Error(`Unknown merge strategy: ${strategy}`);
			}
		}
	}

	// Push result back to origin (if remote exists)
	const remoteResult = await execGit(["remote", "get-url", "origin"], {
		cwd: mergePath,
	});

	if (remoteResult.success) {
		await execGitOrThrow(["push", "origin", baseBranch], {
			cwd: mergePath,
		});
		log.git.info(`Pushed ${baseBranch} to origin`);
	}

	log.git.info(
		`Merged workflow branch ${workflowBranch} into ${baseBranch} using ${strategy} strategy`,
	);
}

/**
 * Merge a pulse branch into the workflow branch
 *
 * This performs a fast-forward merge (pulse branch should be ahead of workflow branch)
 *
 * @param repoRoot - Path to the main repository
 * @param worktreePath - Path to the worktree
 * @param workflowBranch - The workflow branch name
 * @param pulseBranch - The pulse branch to merge
 */
export async function mergePulseBranch(
	repoRoot: string,
	worktreePath: string,
	workflowBranch: string,
	pulseBranch: string,
): Promise<void> {
	// Checkout workflow branch in worktree
	await checkoutInWorktree(worktreePath, workflowBranch);

	// Fast-forward merge the pulse branch
	await fastForwardMerge(worktreePath, pulseBranch);

	// Delete the pulse branch (force since we verified the merge succeeded)
	await deleteBranch(repoRoot, pulseBranch, true);

	log.git.info(`Merged pulse branch ${pulseBranch} into ${workflowBranch}`);
}

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

// =============================================================================
// Cleanup
// =============================================================================

/**
 * Clean up all resources for a workflow
 *
 * Removes the worktree and optionally the workflow branch
 */
export async function cleanupWorkflow(
	repoRoot: string,
	workflowId: string,
	options: { deleteBranch?: boolean } = {},
): Promise<void> {
	const worktreePath = getWorktreePath(repoRoot, workflowId);
	const workflowBranch = `${BRANCH_PREFIX}/${workflowId}`;

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

	// Delete branch if requested
	if (options.deleteBranch) {
		try {
			await deleteBranch(repoRoot, workflowBranch, true);
		} catch {
			log.git.warn(`Could not delete branch ${workflowBranch}`);
		}
	}

	log.git.info(`Cleaned up workflow ${workflowId}`);
}
