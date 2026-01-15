/**
 * Embedding indexer configuration.
 * Shared between file enumeration and file watching.
 */

// =============================================================================
// File Size Limits
// =============================================================================

/** Maximum file size to index (96 KB) */
export const MAX_FILE_SIZE_FOR_EMBEDDING = 96 * 1024;

/** Skip lines longer than this (likely generated/minified) */
export const MAX_LINE_LENGTH = 1000;

// =============================================================================
// Supported Extensions
// =============================================================================

export const EXTENSIONS = {
	code: [
		".ts",
		".tsx",
		".js",
		".jsx",
		".py",
		".rs",
		".go",
		".java",
		".kt",
		".c",
		".cpp",
		".h",
		".hpp",
		".rb",
		".php",
		".swift",
		".sql",
		".cs",
		".fs",
		".vb",
	],
	docs: [".md", ".txt"],
	config: [
		".json",
		".yaml",
		".yml",
		".xml",
		".html",
		".css",
		".sh",
		".bash",
		".zsh",
		".dockerfile",
		".toml",
		".ini",
		".cfg",
	],
} as const;

/** All supported extensions as a Set for fast lookup */
export const SUPPORTED_EXTENSIONS: Set<string> = new Set([
	...EXTENSIONS.code,
	...EXTENSIONS.docs,
	...EXTENSIONS.config,
]);

// =============================================================================
// Exclusions
// =============================================================================

/** Lock files to always skip */
export const LOCK_FILES = new Set([
	"package-lock.json",
	"yarn.lock",
	"pnpm-lock.yaml",
	"bun.lock",
	"Cargo.lock",
	"Gemfile.lock",
	"composer.lock",
	"poetry.lock",
]);

/** Directories to always skip */
export const EXCLUDED_DIRS = new Set([
	"node_modules",
	"vendor",
	"dist",
	".git",
]);

// =============================================================================
// Helpers
// =============================================================================

/**
 * Check if a file extension is supported for indexing.
 */
export function isSupportedExtension(ext: string): boolean {
	return SUPPORTED_EXTENSIONS.has(ext.toLowerCase());
}

/**
 * Check if a filename is a lock file.
 */
export function isLockFile(filename: string): boolean {
	return LOCK_FILES.has(filename);
}

/**
 * Check if a directory should be excluded.
 */
export function isExcludedDir(dirname: string): boolean {
	return EXCLUDED_DIRS.has(dirname) || dirname.startsWith(".");
}

/**
 * Check if a path contains an excluded directory.
 */
export function pathContainsExcludedDir(path: string): boolean {
	const parts = path.split("/");
	return parts.some((part) => isExcludedDir(part));
}
