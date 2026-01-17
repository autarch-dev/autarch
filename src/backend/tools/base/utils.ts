/**
 * Shared utilities for base tools
 *
 * Provides path validation, sensitivity gates, and file system helpers.
 */

import { spawn } from "node:child_process";
import { normalize, resolve } from "node:path";
import type { ToolContext } from "../types";

// =============================================================================
// Root Path Resolution
// =============================================================================

/**
 * Get the effective root path for file operations.
 * Returns worktreePath if available (for pulsing agent isolation),
 * otherwise falls back to projectRoot.
 *
 * @param context - Tool execution context
 * @returns The path to use as the root for file operations
 */
export function getEffectiveRoot(context: ToolContext): string {
	return context.worktreePath ?? context.projectRoot;
}

// =============================================================================
// Path Validation
// =============================================================================

/**
 * Resolve a relative path safely within a project root.
 * Returns null if the path would escape the project root.
 *
 * @param projectRoot - Absolute path to project root
 * @param relativePath - User-provided relative path
 * @returns Absolute path if safe, null if path escapes project root
 */
export function resolveSafePath(
	projectRoot: string,
	relativePath: string,
): string | null {
	// Normalize the input path
	const normalizedRelative = normalize(relativePath);

	// Resolve to absolute path
	const absolutePath = resolve(projectRoot, normalizedRelative);

	// Normalize the project root for comparison
	const normalizedRoot = normalize(projectRoot);

	// Check if resolved path is within project root
	// Use startsWith with trailing separator to prevent escaping via prefix matching
	// e.g., /project-root-other shouldn't match /project-root
	if (
		!absolutePath.startsWith(`${normalizedRoot}/`) &&
		absolutePath !== normalizedRoot
	) {
		return null;
	}

	return absolutePath;
}

// =============================================================================
// Sensitivity Gate
// =============================================================================

/**
 * Patterns for sensitive files that should be blocked from reading.
 * These files commonly contain secrets, credentials, or private keys.
 */
const SENSITIVE_PATTERNS = [
	// Environment files
	/^\.env$/,
	/^\.env\..+$/,
	/\.env\.local$/,
	/\.env\.production$/,
	/\.env\.development$/,

	// Credential files
	/credentials/i,
	/secrets?/i,
	/\.pem$/,
	/\.key$/,
	/\.p12$/,
	/\.pfx$/,

	// Git internals that may contain sensitive config
	/^\.git\/config$/,

	// SSH keys
	/id_rsa/,
	/id_ed25519/,
	/id_ecdsa/,
	/id_dsa/,

	// AWS and cloud credentials
	/\.aws\/credentials$/,
	/\.aws\/config$/,
	/gcloud.*credentials/i,

	// Token/auth files
	/\.npmrc$/,
	/\.netrc$/,
	/\.htpasswd$/,

	// History files that may contain secrets
	/\.bash_history$/,
	/\.zsh_history$/,
];

/**
 * Check if a file path matches sensitive file patterns.
 *
 * @param relativePath - Path relative to project root
 * @returns true if the file should be blocked
 */
export function isSensitiveFile(relativePath: string): boolean {
	// Normalize path separators
	const normalizedPath = relativePath.replace(/\\/g, "/");

	// Check against each pattern
	for (const pattern of SENSITIVE_PATTERNS) {
		if (pattern.test(normalizedPath)) {
			return true;
		}
	}

	// Also check the basename alone
	const basename = normalizedPath.split("/").pop() ?? "";
	for (const pattern of SENSITIVE_PATTERNS) {
		if (pattern.test(basename)) {
			return true;
		}
	}

	return false;
}

// =============================================================================
// Git Integration
// =============================================================================

/**
 * Check if a file path matches gitignore patterns using git check-ignore.
 *
 * @param rootPath - Project root directory
 * @param filePath - Path to check (relative to root)
 * @returns true if the file is ignored by git
 */
export async function isGitIgnored(
	rootPath: string,
	filePath: string,
): Promise<boolean> {
	return new Promise((resolve) => {
		const proc = spawn("git", ["check-ignore", "-q", filePath], {
			cwd: rootPath,
		});

		proc.on("close", (code) => {
			// Exit code 0 means file is ignored
			resolve(code === 0);
		});

		proc.on("error", () => {
			// Git not available - assume not ignored
			resolve(false);
		});
	});
}

// =============================================================================
// Re-exports from embedding service
// =============================================================================

export {
	isExcludedDir,
	pathContainsExcludedDir,
} from "@/backend/services/embedding/config";
