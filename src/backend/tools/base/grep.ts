/**
 * grep - Search file contents for a pattern
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

export const grepInputSchema = z.object({
	reason: z.string().describe(REASON_DESCRIPTION),
	pattern: z
		.string()
		.describe(
			"The search pattern (literal string or regex depending on useRegex parameter)",
		),
	glob: z
		.string()
		.nullable()
		.optional()
		.describe(
			"Optional glob pattern to filter files, e.g., '**/*.cs' for C# files only",
		),
	caseSensitive: z
		.boolean()
		.optional()
		.default(false)
		.describe(
			"If true, perform case-sensitive matching; if false (default), match case-insensitively",
		),
	skip: z
		.number()
		.int()
		.nonnegative()
		.optional()
		.default(0)
		.describe("Number of matches to skip for pagination (default: 0)"),
});

export type GrepInput = z.infer<typeof grepInputSchema>;

export interface GrepMatch {
	file_path: string;
	line_number: number;
}

export interface GrepOutput {
	results: GrepMatch[];
	warning?: string;
}

// =============================================================================
// Tool Definition
// =============================================================================

export const grepTool: ToolDefinition<GrepInput, GrepOutput> = {
	name: "grep",
	description: `Search file contents for a pattern using regex matching.
Returns file paths and line numbers for matches.

- Case-insensitive by default (set caseSensitive=true for exact case matching)
- Respects .gitignore and .autarchignore rules
- Skips binary files and files larger than 10MB
- Returns up to 50 matches; use skip parameter to paginate through more results
- Results are sorted alphabetically by file path

Use glob parameter to filter files, e.g., "**/*.cs" for C# files only.`,
	inputSchema: grepInputSchema,
	execute: async (input, context): Promise<ToolResult<GrepOutput>> => {
		// TODO: Implement grep using ripgrep or similar
		// - Validate regex pattern
		// - Apply glob filter
		// - Skip binary files
		// - Paginate results

		return {
			success: true,
			data: { results: [] },
		};
	},
};
