/**
 * glob_search - Find files matching a glob pattern
 */

import { z } from "zod";
import {
	REASON_DESCRIPTION,
	type ToolDefinition,
	type ToolResult,
} from "../types";
import { isGitIgnored, pathContainsExcludedDir } from "./utils";

// =============================================================================
// Schema
// =============================================================================

export const globSearchInputSchema = z.object({
	reason: z.string().describe(REASON_DESCRIPTION),
	pattern: z
		.string()
		.describe("Glob pattern to match files, e.g., '**/*.cs' or 'src/**/*.ts'"),
});

export type GlobSearchInput = z.infer<typeof globSearchInputSchema>;

export type GlobSearchOutput = string[];

// =============================================================================
// Constants
// =============================================================================

/** Maximum number of results to return */
const MAX_RESULTS = 500;

// =============================================================================
// Tool Definition
// =============================================================================

export const globSearchTool: ToolDefinition<GlobSearchInput, GlobSearchOutput> =
	{
		name: "glob_search",
		description: `Find files matching a glob pattern.
Examples: "**/*.cs" for all C# files, "src/**/test_*.py" for Python test files.
Returns a list of matching file paths relative to the project root.`,
		inputSchema: globSearchInputSchema,
		execute: async (input, context): Promise<ToolResult<GlobSearchOutput>> => {
			// Create glob matcher
			let glob: Bun.Glob;
			try {
				glob = new Bun.Glob(input.pattern);
			} catch {
				return {
					success: false,
					error: `Invalid glob pattern: ${input.pattern}`,
				};
			}

			const results: string[] = [];

			try {
				// Scan for matching files
				const scanner = glob.scan({
					cwd: context.projectRoot,
					onlyFiles: true,
					dot: false, // Skip hidden files
				});

				for await (const match of scanner) {
					// Skip excluded directories
					if (pathContainsExcludedDir(match)) {
						continue;
					}

					// Check gitignore
					const ignored = await isGitIgnored(context.projectRoot, match);
					if (ignored) {
						continue;
					}

					results.push(match);

					// Limit results
					if (results.length >= MAX_RESULTS) {
						break;
					}
				}
			} catch (err) {
				return {
					success: false,
					error: `Glob search failed: ${err instanceof Error ? err.message : "unknown error"}`,
				};
			}

			// Sort results alphabetically
			results.sort((a, b) => a.localeCompare(b));

			return {
				success: true,
				data: results,
			};
		},
	};
