/**
 * Project Root - CLI argument parsing and centralized project root management
 *
 * Parses a single positional CLI argument as the target project directory.
 * Supports tilde (~) expansion and relative paths.
 * Falls back to current working directory if no argument provided.
 */

import { homedir } from "node:os";
import { isAbsolute, resolve } from "node:path";
import { findRepoRoot } from "./git";
import { log } from "./logger";

// =============================================================================
// Module State
// =============================================================================

let cachedProjectRoot: string | null = null;

// =============================================================================
// Path Resolution
// =============================================================================

/**
 * Expand tilde (~) to home directory in a path.
 *
 * @param path - Path that may contain ~ prefix
 * @returns Path with ~ expanded to home directory
 */
function expandTilde(path: string): string {
	if (path === "~" || path.startsWith("~/")) {
		return path.replace(/^~/, homedir());
	}
	return path;
}

/**
 * Resolve a path to an absolute path.
 * Handles tilde expansion and relative paths.
 *
 * @param path - Path to resolve (absolute, relative, or with ~)
 * @returns Absolute path
 */
function resolvePath(path: string): string {
	const expanded = expandTilde(path);
	if (isAbsolute(expanded)) {
		return expanded;
	}
	return resolve(process.cwd(), expanded);
}

// =============================================================================
// CLI Argument Parsing
// =============================================================================

/**
 * Parse CLI arguments and return the target directory.
 * Expects a single positional argument for the project directory.
 *
 * For Bun:
 * - process.argv[0] is the bun executable
 * - process.argv[1] is the script path
 * - process.argv[2] onwards are user arguments
 *
 * @returns The target directory (resolved absolute path) or null if not provided
 */
function parseTargetDirectory(): string | null {
	// Skip executable and script path
	const args = process.argv.slice(2);

	// No arguments provided
	if (args.length === 0) {
		return null;
	}

	// Take the first positional argument as the project directory
	const targetArg = args[0];

	// No argument or it looks like a flag (starts with -)
	if (targetArg === undefined || targetArg.startsWith("-")) {
		return null;
	}

	return resolvePath(targetArg);
}

// =============================================================================
// Project Root Management
// =============================================================================

/**
 * Initialize and return the project root.
 * Parses CLI arguments for a target directory, or falls back to cwd.
 * Validates that the directory is a valid git repository.
 *
 * @returns The project root path
 * @throws Error with user-friendly message if the path is not a git repository
 */
export function initProjectRoot(): string {
	if (cachedProjectRoot !== null) {
		return cachedProjectRoot;
	}

	const targetDir = parseTargetDirectory();
	const startDir = targetDir ?? process.cwd();

	try {
		cachedProjectRoot = findRepoRoot(startDir);

		if (targetDir !== null) {
			log.server.info(`Target directory: ${targetDir}`);
		}

		return cachedProjectRoot;
	} catch {
		if (targetDir !== null) {
			log.server.error(`Not a git repository: ${targetDir}`);
			process.exit(1);
		}
		throw new Error("Not a git repository (or any parent up to root)");
	}
}

/**
 * Get the project root path.
 * Must call initProjectRoot() first during startup.
 *
 * @returns The cached project root path
 * @throws Error if initProjectRoot() has not been called
 */
export function getProjectRoot(): string {
	if (cachedProjectRoot === null) {
		throw new Error(
			"Project root not initialized. Call initProjectRoot() first.",
		);
	}
	return cachedProjectRoot;
}
