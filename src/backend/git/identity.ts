/**
 * Git Identity Resolution
 *
 * Resolves git author and committer identity environment variables
 * for use in git commit and merge operations.
 */

import {
	getGitAuthorEmail,
	getGitAuthorName,
} from "@/backend/services/projectSettings";
import { execGit } from "./git-executor";

// =============================================================================
// Identity Resolution
// =============================================================================

/**
 * Resolve git identity environment variables for git commands.
 *
 * Author identity resolution chain:
 *   1. project_meta (per-project setting via getGitAuthorName/getGitAuthorEmail)
 *   2. git config CLI (repo → global → system via `git config user.name`/`user.email`)
 *   3. Omit — if neither source provides a value, the key is not included
 *
 * Committer identity is always set to Autarch.
 *
 * @param projectRoot - The root directory of the project
 * @returns Environment variables to pass to git commands
 */
export async function resolveGitIdentityEnv(
	projectRoot: string,
): Promise<Record<string, string>> {
	const env: Record<string, string> = {
		GIT_COMMITTER_NAME: "Autarch",
		GIT_COMMITTER_EMAIL: "hello@autarch.dev",
	};

	// Resolve author name: project_meta → git config → omit
	const authorName = await getGitAuthorName(projectRoot);
	if (authorName !== null) {
		env.GIT_AUTHOR_NAME = authorName;
	} else {
		const result = await execGit(["config", "user.name"], {
			cwd: projectRoot,
		});
		if (result.success) {
			env.GIT_AUTHOR_NAME = result.stdout.trim();
		}
	}

	// Resolve author email: project_meta → git config → omit
	const authorEmail = await getGitAuthorEmail(projectRoot);
	if (authorEmail !== null) {
		env.GIT_AUTHOR_EMAIL = authorEmail;
	} else {
		const result = await execGit(["config", "user.email"], {
			cwd: projectRoot,
		});
		if (result.success) {
			env.GIT_AUTHOR_EMAIL = result.stdout.trim();
		}
	}

	return env;
}
