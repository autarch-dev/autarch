/**
 * grep - Search file contents for a pattern using ripgrep
 */

import { z } from "zod";
import { getRipgrepPath } from "@/backend/services/ripgrep";
import {
	REASON_DESCRIPTION,
	type ToolDefinition,
	type ToolResult,
} from "../types";
import { getEffectiveRoot } from "./utils";

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

// =============================================================================
// Constants
// =============================================================================

/** Maximum matches to return per call */
const MAX_RESULTS = 50;

/** Maximum length for a single output line (truncate longer lines) */
const MAX_LINE_LENGTH = 200;

// =============================================================================
// Tool Definition
// =============================================================================

export const grepTool: ToolDefinition<GrepInput> = {
	name: "grep",
	description: `Search file contents for a pattern using regex matching.
Returns matches in standard grep format: file:line:content (one per line).

- Case-insensitive by default (set caseSensitive=true for exact case matching)
- Respects .gitignore and .autarchignore rules
- Skips binary files
- Returns up to 50 matches; use skip parameter to paginate through more results

Use glob parameter to filter files, e.g., "**/*.cs" for C# files only.`,
	inputSchema: grepInputSchema,
	execute: async (input, context): Promise<ToolResult> => {
		// Build ripgrep arguments
		const args: string[] = [
			"--line-number", // Include line numbers
			"--no-heading", // Don't group by file
			"--color=never", // No ANSI colors
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

		// Use worktree path if available (for pulsing agent isolation)
		const rootPath = getEffectiveRoot(context);

		// Run ripgrep
		let proc: Bun.Subprocess;
		try {
			const rgPath = await getRipgrepPath();
			proc = Bun.spawn([rgPath, ...args], {
				cwd: rootPath,
				stdout: "pipe",
				stderr: "pipe",
			});
		} catch (err) {
			return {
				success: false,
				output: `Error: Failed to spawn ripgrep: ${err instanceof Error ? err.message : "unknown error"}`,
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
				output: "Error: Failed to capture ripgrep output",
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
				output: `Error: ripgrep failed: ${stderr || "unknown error"}`,
			};
		}

		// Process output: paginate, truncate long lines
		const skip = input.skip ?? 0;
		const allLines = stdout.split("\n").filter((line) => line.length > 0);
		const totalMatches = allLines.length;

		if (totalMatches === 0) {
			return {
				success: true,
				output: "No matches found.",
			};
		}

		const lines = allLines
			.slice(skip, skip + MAX_RESULTS)
			.map((line) =>
				line.length > MAX_LINE_LENGTH
					? `${line.slice(0, MAX_LINE_LENGTH)}...`
					: line,
			);

		// Add pagination notice if there are more results
		if (totalMatches > skip + MAX_RESULTS) {
			const remaining = totalMatches - skip - MAX_RESULTS;
			lines.push(
				`--- ${remaining} more matches (use skip=${skip + MAX_RESULTS} to continue) ---`,
			);
		}

		return {
			success: true,
			output: lines.join("\n"),
		};
	},
};
