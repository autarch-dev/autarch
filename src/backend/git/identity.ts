/**
 * Git Identity Resolution
 *
 * Resolves git author and committer identity environment variables
 * for use in git commit and merge operations.
 */

import { log } from "@/backend/logger";
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
 * @param projectRoot - The root directory of the project, or null to skip DB lookup
 * @param cwd - Working directory for git config resolution (defaults to projectRoot)
 * @returns Environment variables to pass to git commands
 */
export async function resolveGitIdentityEnv(
	projectRoot: string | null,
	cwd?: string,
): Promise<Record<string, string>> {
	const gitCwd = cwd ?? projectRoot ?? process.cwd();
	const env: Record<string, string> = {
		GIT_COMMITTER_NAME: "autarch-cli[bot]",
		GIT_COMMITTER_EMAIL: "260802642+autarch-cli[bot]@users.noreply.github.com",
	};

	// Resolve author name: project_meta → git config → omit
	let authorName: string | null = null;
	if (projectRoot !== null) {
		try {
			authorName = await getGitAuthorName(projectRoot);
		} catch (_err) {
			log.git.debug(
				"Could not read author name from project_meta, falling back to git config",
			);
		}
	}
	if (authorName !== null) {
		env.GIT_AUTHOR_NAME = authorName;
	} else {
		const result = await execGit(["config", "user.name"], {
			cwd: gitCwd,
		});
		if (result.success) {
			env.GIT_AUTHOR_NAME = result.stdout.trim();
		}
	}

	// Resolve author email: project_meta → git config → omit
	let authorEmail: string | null = null;
	if (projectRoot !== null) {
		try {
			authorEmail = await getGitAuthorEmail(projectRoot);
		} catch (_err) {
			log.git.debug(
				"Could not read author email from project_meta, falling back to git config",
			);
		}
	}
	if (authorEmail !== null) {
		env.GIT_AUTHOR_EMAIL = authorEmail;
	} else {
		const result = await execGit(["config", "user.email"], {
			cwd: gitCwd,
		});
		if (result.success) {
			env.GIT_AUTHOR_EMAIL = result.stdout.trim();
		}
	}

	return env;
}
