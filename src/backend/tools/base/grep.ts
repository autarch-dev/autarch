/**
 * grep - Search file contents for a pattern using ripgrep
 */

import { rgPath } from "@joshua.litt/get-ripgrep";
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
// Constants
// =============================================================================

/** Maximum matches to return per call */
const MAX_RESULTS = 50;

// =============================================================================
// Ripgrep JSON Types
// =============================================================================

interface RipgrepMatch {
	type: "match";
	data: {
		path: { text: string };
		lines: { text: string };
		line_number: number;
		absolute_offset: number;
		submatches: Array<{
			match: { text: string };
			start: number;
			end: number;
		}>;
	};
}

interface RipgrepBegin {
	type: "begin";
	data: { path: { text: string } };
}

interface RipgrepEnd {
	type: "end";
	data: { path: { text: string }; stats: unknown };
}

interface RipgrepSummary {
	type: "summary";
	data: { stats: unknown };
}

type RipgrepMessage = RipgrepMatch | RipgrepBegin | RipgrepEnd | RipgrepSummary;

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
		// Build ripgrep arguments
		const args: string[] = [
			"--json", // JSON output for structured parsing
		];

		// Case sensitivity
		if (!input.caseSensitive) {
			args.push("--ignore-case");
		}

		// Glob filter
		if (input.glob) {
			args.push("--glob", input.glob);
		}

		// Add the pattern and path
		args.push("--", input.pattern, ".");

		// Run ripgrep
		let proc: Bun.Subprocess;
		try {
			proc = Bun.spawn([rgPath, ...args], {
				cwd: context.projectRoot,
				stdout: "pipe",
				stderr: "pipe",
			});
		} catch (err) {
			return {
				success: false,
				error: `Failed to spawn ripgrep: ${err instanceof Error ? err.message : "unknown error"}`,
			};
		}

		// Read output
		const stdoutStream = proc.stdout;
		const stderrStream = proc.stderr;

		if (
			typeof stdoutStream === "number" ||
			typeof stderrStream === "number" ||
			!stdoutStream ||
			!stderrStream
		) {
			return {
				success: false,
				error: "Failed to capture ripgrep output",
			};
		}

		const stdout = await new Response(stdoutStream).text();
		const stderr = await new Response(stderrStream).text();
		const exitCode = await proc.exited;

		// Exit code 1 means no matches (not an error)
		// Exit code 2+ means actual error
		if (exitCode > 1) {
			return {
				success: false,
				error: `ripgrep failed: ${stderr || "unknown error"}`,
			};
		}

		// Parse JSON lines output
		const results: GrepMatch[] = [];
		const lines = stdout.split("\n").filter((line) => line.trim());
		let skipped = 0;
		const skip = input.skip ?? 0;

		for (const line of lines) {
			let msg: RipgrepMessage;
			try {
				msg = JSON.parse(line) as RipgrepMessage;
			} catch {
				continue; // Skip malformed lines
			}

			if (msg.type !== "match") {
				continue;
			}

			// Handle pagination
			if (skipped < skip) {
				skipped++;
				continue;
			}

			results.push({
				file_path: msg.data.path.text,
				line_number: msg.data.line_number,
			});

			if (results.length >= MAX_RESULTS) {
				break;
			}
		}

		// Sort by file path
		results.sort((a, b) => {
			const pathCmp = a.file_path.localeCompare(b.file_path);
			if (pathCmp !== 0) return pathCmp;
			return a.line_number - b.line_number;
		});

		const output: GrepOutput = { results };

		// Add warning if we hit the limit
		if (results.length >= MAX_RESULTS) {
			output.warning = `Results limited to ${MAX_RESULTS} matches. Use skip parameter to paginate.`;
		}

		return {
			success: true,
			data: output,
		};
	},
};
