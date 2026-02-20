/**
 * list_directory - List files and directories at a path
 */

import type { Dirent } from "node:fs";
import { readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { z } from "zod";
import {
	REASON_DESCRIPTION,
	type ToolDefinition,
	type ToolResult,
} from "../types";
import {
	getEffectiveRoot,
	isExcludedDir,
	isGitIgnored,
	resolveSafePath,
} from "./utils";

// =============================================================================
// Schema
// =============================================================================

export const listDirectoryInputSchema = z.object({
	reason: z.string().describe(REASON_DESCRIPTION),
	path: z
		.string()
		.optional()
		.default(".")
		.describe("Path relative to project root (empty or '.' for root)"),
	depth: z.coerce
		.number()
		.int()
		.positive()
		.nullable()
		.optional()
		.default(1)
		.describe(
			"Maximum depth to traverse (1 = immediate children, null = unlimited)",
		),
	type: z
		.enum(["files", "directories", "all"])
		.optional()
		.default("all")
		.describe("Type of entries: 'files', 'directories', or 'all'"),
	glob: z
		.string()
		.nullable()
		.optional()
		.describe(
			"Optional glob pattern to filter results, e.g. '**/*.cs' for all C# files",
		),
});

export type ListDirectoryInput = z.infer<typeof listDirectoryInputSchema>;

interface DirectoryEntry {
	path: string;
	is_directory: boolean;
}

// =============================================================================
// Tool Definition
// =============================================================================

export const listDirectoryTool: ToolDefinition<ListDirectoryInput> = {
	name: "list_directory",
	description: `List files and directories at a given path.
Respects .gitignore and .autarchignore rules.
Returns a newline-separated list of relative paths. Directories have a trailing slash (e.g. "src/components/").

- depth controls how deep to traverse (1 = immediate children, 2 = children + grandchildren, null = unlimited - defaults to 1)
- type filters results: 'files' (only files), 'directories' (only dirs), 'all' (both) - defaults to 'all'
- optionally, a glob pattern can be used to filter results, e.g. "**/*.cs" for all C# files`,
	inputSchema: listDirectoryInputSchema,
	execute: async (input, context): Promise<ToolResult> => {
		// Use worktree path if available (for pulsing agent isolation)
		const rootPath = getEffectiveRoot(context);

		// Resolve and validate path
		const targetPath = input.path || ".";
		const absolutePath = resolveSafePath(rootPath, targetPath);
		if (!absolutePath) {
			return {
				success: false,
				output: `Error: Invalid path: ${targetPath} - path must be within project root`,
			};
		}

		// Prepare glob matcher if provided
		let globMatcher: Bun.Glob | null = null;
		if (input.glob) {
			try {
				globMatcher = new Bun.Glob(input.glob);
			} catch {
				return {
					success: false,
					output: `Error: Invalid glob pattern: ${input.glob}`,
				};
			}
		}

		const results: DirectoryEntry[] = [];
		const maxDepth = input.depth ?? Number.MAX_SAFE_INTEGER;
		const typeFilter = input.type ?? "all";

		// Recursive directory walker
		async function walk(
			currentPath: string,
			currentDepth: number,
		): Promise<void> {
			if (currentDepth > maxDepth) {
				return;
			}

			let entries: Dirent[];
			try {
				entries = await readdir(currentPath, { withFileTypes: true });
			} catch {
				// Directory doesn't exist or can't be read
				return;
			}

			for (const entry of entries) {
				const entryAbsPath = join(currentPath, entry.name);
				const entryRelPath = relative(rootPath, entryAbsPath);

				// Skip hidden files/directories
				if (entry.name.startsWith(".")) {
					continue;
				}

				// Skip excluded directories
				if (entry.isDirectory() && isExcludedDir(entry.name)) {
					continue;
				}

				// Check gitignore
				const ignored = await isGitIgnored(rootPath, entryRelPath);
				if (ignored) {
					continue;
				}

				const isDir = entry.isDirectory();

				// Apply type filter
				if (typeFilter === "files" && isDir) {
					// Still recurse into directories even if filtering to files only
					if (currentDepth < maxDepth) {
						await walk(entryAbsPath, currentDepth + 1);
					}
					continue;
				}
				if (typeFilter === "directories" && !isDir) {
					continue;
				}

				// Apply glob filter if provided
				if (globMatcher && !globMatcher.match(entryRelPath)) {
					// Still recurse into directories even if they don't match
					if (isDir && currentDepth < maxDepth) {
						await walk(entryAbsPath, currentDepth + 1);
					}
					continue;
				}

				results.push({
					path: entryRelPath,
					is_directory: isDir,
				});

				// Recurse into directories
				if (isDir && currentDepth < maxDepth) {
					await walk(entryAbsPath, currentDepth + 1);
				}
			}
		}

		try {
			await walk(absolutePath, 1);
		} catch (err) {
			return {
				success: false,
				output: `Error: Failed to list directory: ${targetPath} - ${err instanceof Error ? err.message : "unknown error"}`,
			};
		}

		// Sort results by path
		results.sort((a, b) => a.path.localeCompare(b.path));

		// Format as plain text with trailing slashes for directories
		const output = results
			.map((entry) => (entry.is_directory ? `${entry.path}/` : entry.path))
			.join("\n");

		return {
			success: true,
			output: output || "(empty directory)",
		};
	},
};
