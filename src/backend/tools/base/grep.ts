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
	include: z
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

/** Maximum length for a single output line (truncate longer lines) */
const MAX_LINE_LENGTH = 2000;

// =============================================================================
// Tool Definition
// =============================================================================

export const grepTool: ToolDefinition<GrepInput> = {
	name: "grep",
	description: `- Search file contents for a pattern using full regex matching.
- Filter files by pattern with the \`include\` parameter, e.g., "**/*.cs" for C# files only.
- Returns file paths and line numbers with at least one match sorted by modification time`,
	inputSchema: grepInputSchema,
	execute: async (input, context): Promise<ToolResult> => {
		// Use worktree path if available (for pulsing agent isolation)
		const rootPath = getEffectiveRoot(context);

		// Build ripgrep arguments
		const args: string[] = [
			"-nH",
			"--hidden",
			"--follow",
			"--no-messages",
			"--field-match-separator=|",
			"--regexp",
			input.pattern,
		];

		// Glob filter
		if (input.include) {
			args.push("--glob", input.include);
		}

		args.push(rootPath);

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
		if (exitCode === 1 || (exitCode === 2 && !stdout.trim())) {
			return {
				success: true,
				output: "No files found.",
			};
		}

		if (exitCode !== 0 && exitCode !== 2) {
			return {
				success: false,
				output: `Error: ripgrep failed: ${stderr || "unknown error"}`,
			};
		}

		// Process output: paginate, truncate long lines
		const hasErrors = exitCode === 2;

		// Handle both Unix (\n) and Windows (\r\n) line endings
		const lines = stdout.trim().split(/\r?\n/);
		const matches = [];

		for (const line of lines) {
			if (!line) continue;

			const [filePath, lineNumStr, ...lineTextParts] = line.split("|");
			if (!filePath || !lineNumStr || lineTextParts.length === 0) continue;

			const lineNum = parseInt(lineNumStr, 10);
			const lineText = lineTextParts.join("|");

			const file = Bun.file(filePath);
			const stats = await file.stat().catch(() => null);
			if (!stats) continue;

			// Convert absolute path to relative path
			const relativePath = filePath.startsWith(rootPath)
				? filePath.slice(rootPath.length).replace(/^\//, "")
				: filePath;

			console.log("relativePath", relativePath);
			console.log("filePath", filePath);
			console.log("rootPath", rootPath);

			matches.push({
				path: relativePath,
				modTime: stats.mtime.getTime(),
				lineNum,
				lineText,
			});
		}

		matches.sort((a, b) => b.modTime - a.modTime);
		console.log("matches", matches);

		const limit = 100;
		const truncated = matches.length > limit;
		const finalMatches = truncated ? matches.slice(0, limit) : matches;

		if (finalMatches.length === 0) {
			return {
				success: true,
				output: "No files found",
			};
		}

		const outputLines = [`Found ${finalMatches.length} matches`];

		let currentFile = "";
		for (const match of finalMatches) {
			if (currentFile !== match.path) {
				if (currentFile !== "") {
					outputLines.push("");
				}
				currentFile = match.path;
				outputLines.push(`${match.path}:`);
			}
			const truncatedLineText =
				match.lineText.length > MAX_LINE_LENGTH
					? `${match.lineText.substring(0, MAX_LINE_LENGTH)}...`
					: match.lineText;
			outputLines.push(`  Line ${match.lineNum}: ${truncatedLineText}`);
		}

		if (truncated) {
			outputLines.push("");
			outputLines.push(
				"(Results are truncated. Consider using a more specific path or pattern.)",
			);
		}

		if (hasErrors) {
			outputLines.push("");
			outputLines.push("(Some paths were inaccessible and skipped)");
		}

		return {
			success: true,
			output: outputLines.join("\n"),
		};
	},
};
