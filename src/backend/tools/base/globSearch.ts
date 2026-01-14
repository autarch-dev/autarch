/**
 * glob_search - Find files matching a glob pattern
 */

import { z } from "zod";
import {
	REASON_DESCRIPTION,
	type ToolDefinition,
	type ToolResult,
} from "../types";

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
			// TODO: Implement glob search
			// - Use fast-glob or similar
			// - Respect .gitignore

			return {
				success: true,
				data: [],
			};
		},
	};
