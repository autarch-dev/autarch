/**
 * Merge Operations
 *
 * Functions for merging branches using various strategies (fast-forward, squash,
 * merge-commit, rebase). Handles complex worktree locking/detachment for rebase
 * operations.
 */

import { log } from "@/backend/logger";
import { getProjectRootOrNull } from "@/backend/projectRoot";
import { deleteBranch } from "./branches";
import { hasUncommittedChanges } from "./commits";
import { execGit, execGitOrThrow } from "./git-executor";
import { resolveGitIdentityEnv } from "./identity";
import type { MergeStrategy } from "./types";
import { checkoutInWorktree, listWorktrees } from "./worktrees";

// =============================================================================
// Private Helpers
// =============================================================================

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
 * Extract pulse IDs from commit messages in a commit range
 *
 * Parses Autarch-Pulse-Id trailers from all commits between baseBranch and sourceBranch.
 *
 * @param cwd - Working directory (repository or worktree path)
 * @param baseBranch - The base branch (commits reachable from here are excluded)
 * @param sourceBranch - The source branch (commits reachable from here are included)
 * @returns Sorted array of unique pulse IDs found in the commit range
 */
export async function extractPulseIdsFromCommitRange(
	cwd: string,
	baseBranch: string,
	sourceBranch: string,
): Promise<string[]> {
	// Get all commit message bodies in the range
	const output = await execGitOrThrow(
		["log", `${baseBranch}..${sourceBranch}`, "--format=%B"],
		{ cwd },
	);

	if (!output) {
		return [];
	}

	// Parse Autarch-Pulse-Id trailers from commit messages
	const pulseIdRegex = /^Autarch-Pulse-Id:\s*(.+)$/gm;
	const pulseIds = new Set<string>();

	for (const match of output.matchAll(pulseIdRegex)) {
		const pulseId = match[1];
		if (pulseId) {
			pulseIds.add(pulseId.trim());
		}
	}

	// Return as sorted array
	return Array.from(pulseIds).sort();
}

/**
 * Squash merge a branch into the current branch
 *
 * @param worktreePath - Path to the worktree (must be on target branch)
 * @param sourceBranch - Branch to merge from
 * @param commitMessage - Message for the squash commit
 * @param options - Optional settings for trailers and pulse ID extraction
 * @param options.trailers - Key-value pairs to add as Git trailers
 * @param options.baseBranch - Base branch for extracting pulse IDs from commit range
 * @param options.cwd - Working directory for git commands (defaults to worktreePath)
 */
export async function squashMerge(
	worktreePath: string,
	sourceBranch: string,
	commitMessage: string,
	options?: {
		trailers?: Record<string, string>;
		baseBranch?: string;
		cwd?: string;
	},
): Promise<void> {
	await execGitOrThrow(["merge", "--squash", sourceBranch], {
		cwd: worktreePath,
	});

	// Build commit message with optional trailers
	let fullMessage = commitMessage;
	if (options?.trailers && Object.keys(options.trailers).length > 0) {
		// Extract pulse IDs from commit range if baseBranch is provided
		let pulseIds: string[] = [];
		if (options.baseBranch) {
			pulseIds = await extractPulseIdsFromCommitRange(
				options.cwd || worktreePath,
				options.baseBranch,
				sourceBranch,
			);
		}

		// Build trailer lines: start with provided trailers, then add pulse IDs
		const trailerLines = Object.entries(options.trailers).map(
			([key, value]) => `${key}: ${value}`,
		);
		for (const id of pulseIds) {
			trailerLines.push(`Autarch-Pulse-Id: ${id}`);
		}

		fullMessage = `${commitMessage}\n\n${trailerLines.join("\n")}`;
	}

	await execGitOrThrow(["commit", "-m", fullMessage], {
		cwd: worktreePath,
		env: {
			...(await resolveGitIdentityEnv(getProjectRootOrNull(), worktreePath)),
		},
	});

	log.git.info(`Squash merged ${sourceBranch}`);
}

/**
 * Create a merge commit (no fast-forward)
 *
 * Unlike squashMerge, this does not extract or include Autarch-Pulse-Id trailers.
 * The individual pulse commits remain in the git history with their full trailers,
 * so pulse IDs are already captured and don't need to be duplicated in the merge commit.
 *
 * @param worktreePath - Path to the worktree (must be on target branch)
 * @param sourceBranch - Branch to merge from
 * @param commitMessage - Message for the merge commit
 * @param trailers - Optional Git trailers to append (key-value pairs)
 */
export async function mergeCommit(
	worktreePath: string,
	sourceBranch: string,
	commitMessage: string,
	trailers?: Record<string, string>,
): Promise<void> {
	// Build commit message with optional trailers
	let fullMessage = commitMessage;
	if (trailers && Object.keys(trailers).length > 0) {
		const trailerLines = Object.entries(trailers)
			.map(([key, value]) => `${key}: ${value}`)
			.join("\n");
		fullMessage = `${commitMessage}\n\n${trailerLines}`;
	}

	await execGitOrThrow(["merge", "--no-ff", "-m", fullMessage, sourceBranch], {
		cwd: worktreePath,
		env: {
			...(await resolveGitIdentityEnv(getProjectRootOrNull(), worktreePath)),
		},
	});

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
 * @param trailers - Optional Git trailers to add (used by squash and merge-commit strategies)
 */
export async function mergeWorkflowBranch(
	repoRoot: string,
	worktreePath: string,
	baseBranch: string,
	workflowBranch: string,
	strategy: MergeStrategy,
	commitMessage: string,
	trailers?: Record<string, string>,
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
				await squashMerge(mergePath, workflowBranch, commitMessage, {
					trailers,
					baseBranch,
					cwd: repoRoot,
				});
				break;
			case "merge-commit":
				await mergeCommit(mergePath, workflowBranch, commitMessage, trailers);
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
