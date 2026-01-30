/**
 * Commit Operations
 *
 * Functions for managing git commits: checking for changes, staging,
 * committing, and creating recovery checkpoints.
 */

import { log } from "@/backend/logger";
import { getCurrentCommit } from "./branches";
import { execGit, execGitOrThrow } from "./git-executor";

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
