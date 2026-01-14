import { spawn } from "node:child_process";
import { readdir, readFile, stat } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import {
	isExcludedDir,
	isLockFile,
	isSupportedExtension,
	MAX_FILE_SIZE,
} from "./config";

// =============================================================================
// Types
// =============================================================================

export interface IndexableFile {
	/** Absolute path to the file */
	absolutePath: string;
	/** Relative path from the root */
	relativePath: string;
	/** File size in bytes */
	size: number;
}

// =============================================================================
// Git Integration
// =============================================================================

/**
 * Check if a file path matches gitignore patterns using git check-ignore.
 */
async function isGitIgnored(
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
// Binary Detection
// =============================================================================

/**
 * Check if file content appears to be binary.
 * Binary files have >10% control characters or contain null bytes.
 */
function isBinaryContent(buffer: Buffer): boolean {
	// Check for null bytes (definite binary indicator)
	if (buffer.includes(0)) {
		return true;
	}

	// Count control characters (excluding common whitespace)
	let controlCount = 0;
	for (const byte of buffer) {
		// Control chars are 0-31, excluding tab (9), newline (10), carriage return (13)
		if (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13) {
			controlCount++;
		}
	}

	// More than 10% control characters indicates binary
	return controlCount / buffer.length > 0.1;
}

// =============================================================================
// File Selection
// =============================================================================

/**
 * Recursively find all indexable files in a directory.
 *
 * Filters:
 * - Supported extensions only
 * - Files <= 96 KB
 * - Not in .gitignore
 * - Not lock files
 * - Not binary files
 *
 * @param rootPath - The root directory to search
 * @returns Array of indexable files with metadata
 */
export async function findIndexableFiles(
	rootPath: string,
): Promise<IndexableFile[]> {
	const files: IndexableFile[] = [];

	async function walk(dir: string): Promise<void> {
		const entries = await readdir(dir, { withFileTypes: true });

		for (const entry of entries) {
			const absolutePath = join(dir, entry.name);
			const relativePath = relative(rootPath, absolutePath);

			// Skip excluded directories
			if (entry.isDirectory()) {
				if (isExcludedDir(entry.name)) {
					continue;
				}
				await walk(absolutePath);
				continue;
			}

			// Skip non-files
			if (!entry.isFile()) {
				continue;
			}

			// Skip hidden files
			if (entry.name.startsWith(".")) {
				continue;
			}

			// Check extension
			const ext = extname(entry.name);
			if (!isSupportedExtension(ext)) {
				continue;
			}

			// Skip lock files
			if (isLockFile(entry.name)) {
				continue;
			}

			// Check file size
			const stats = await stat(absolutePath);
			if (stats.size > MAX_FILE_SIZE) {
				continue;
			}

			// Check if gitignored
			const ignored = await isGitIgnored(rootPath, relativePath);
			if (ignored) {
				continue;
			}

			files.push({
				absolutePath,
				relativePath,
				size: stats.size,
			});
		}
	}

	await walk(rootPath);
	return files;
}

/**
 * Read file content and check if it's binary.
 * Returns null if the file is binary.
 *
 * @param filePath - Absolute path to the file
 * @returns File content as string, or null if binary
 */
export async function readFileIfText(filePath: string): Promise<string | null> {
	const buffer = await readFile(filePath);

	if (isBinaryContent(buffer)) {
		return null;
	}

	return buffer.toString("utf-8");
}

/**
 * Calculate total size of files for progress reporting.
 */
export function calculateTotalSize(files: IndexableFile[]): number {
	return files.reduce((sum, file) => sum + file.size, 0);
}
