/**
 * edit_file - Apply exact string replacement in a file
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, join, normalize } from "node:path";
import { z } from "zod";
import { log } from "@/backend/logger";
import { getEffectiveRoot } from "../base/utils";
import {
	REASON_DESCRIPTION,
	type ToolDefinition,
	type ToolResult,
} from "../types";
import { clearTSProjectCache, getDiagnostics } from "./diagnostics";
import { executePostWriteHooks } from "./hooks";

// =============================================================================
// Schema
// =============================================================================

export const editFileInputSchema = z.object({
	reason: z.string().describe(REASON_DESCRIPTION),
	path: z.string().describe("Path to file, relative to worktree root"),
	oldString: z
		.string()
		.describe(
			"Exact content to match in the file (must be found as-is, including whitespace and indentation)",
		),
	newString: z
		.string()
		.describe(
			"Replacement content for the matched string (must preserve intended indentation and structure)",
		),
	replaceAll: z
		.boolean()
		.optional()
		.default(false)
		.describe(
			"If true, replaces all occurrences of oldString; otherwise, fails if multiple matches are found",
		),
});

export type EditFileInput = z.infer<typeof editFileInputSchema>;

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Count occurrences of a substring in a string
 */
function countOccurrences(content: string, search: string): number {
	let count = 0;
	let pos = content.indexOf(search, 0);
	while (pos !== -1) {
		count++;
		pos = content.indexOf(search, pos + search.length);
	}
	return count;
}

/**
 * Find all occurrence positions of a substring in a string
 * Returns array of starting positions (0-indexed)
 */
// biome-ignore lint/correctness/noUnusedVariables: Helper for context output (used in subsequent pulse)
function findAllOccurrencePositions(content: string, search: string): number[] {
	const positions: number[] = [];
	let pos = content.indexOf(search, 0);
	while (pos !== -1) {
		positions.push(pos);
		pos = content.indexOf(search, pos + search.length);
	}
	return positions;
}

/**
 * Get 1-based line number for a position in content
 */
// biome-ignore lint/correctness/noUnusedVariables: Helper for context output (used in subsequent pulse)
function getLineNumber(content: string, position: number): number {
	return content.substring(0, position).split("\n").length;
}

/**
 * Extract context lines with file boundary handling
 * @param lines Array of file lines (0-indexed)
 * @param startLine 1-based start line of the target region
 * @param endLine 1-based end line of the target region
 * @param contextSize Number of context lines before and after
 * @returns Extracted lines and actual 1-based start/end after boundary clamping
 */
// biome-ignore lint/correctness/noUnusedVariables: Helper for context output (used in subsequent pulse)
function extractContextLines(
	lines: string[],
	startLine: number,
	endLine: number,
	contextSize: number,
): { lines: string[]; actualStart: number; actualEnd: number } {
	const actualStart = Math.max(1, startLine - contextSize);
	const actualEnd = Math.min(lines.length, endLine + contextSize);
	// Convert to 0-indexed for array slice
	const extractedLines = lines.slice(actualStart - 1, actualEnd);
	return { lines: extractedLines, actualStart, actualEnd };
}

/**
 * Format context output with markdown header
 * @param filePath Path to the file
 * @param startLine 1-based start line
 * @param endLine 1-based end line
 * @param contextLines Array of lines to include
 * @returns Formatted markdown string
 */
// biome-ignore lint/correctness/noUnusedVariables: Helper for context output (used in subsequent pulse)
function formatContextOutput(
	filePath: string,
	startLine: number,
	endLine: number,
	contextLines: string[],
): string {
	return `### ${filePath}:${startLine}-${endLine}\n${contextLines.join("\n")}`;
}

// =============================================================================
// Tool Definition
// =============================================================================

export const editFileTool: ToolDefinition<EditFileInput> = {
	name: "edit_file",
	description: `Apply an **exact string replacement** in files within the worktree.
Supports single-instance replacements (oldString → newString) and multi-instance replacements via replaceAll.

Edits are applied atomically: if any replacement fails (e.g., oldString not found or multiple matches when replaceAll is not set), no changes are applied and the tool reports a hard failure.

Rules:
- You must read the target file with read_file before editing.
- The oldString must match the file content exactly, including indentation, whitespace, and line endings.
- Line number prefixes from read_file output must not be included in oldString or newString.

Failure is final: do not attempt fuzzy matching or retries.
Note: You are working in an isolated git worktree. Changes are isolated until pulse completion.`,
	inputSchema: editFileInputSchema,
	execute: async (input, context): Promise<ToolResult> => {
		// Use worktree path if available (for pulsing agent isolation)
		const root = getEffectiveRoot(context);

		// Validate path
		if (isAbsolute(input.path)) {
			return {
				success: false,
				output: "Error: Path must be relative to worktree root",
			};
		}

		const normalizedPath = normalize(input.path);
		if (normalizedPath.startsWith("..")) {
			return {
				success: false,
				output: "Error: Path cannot escape worktree root",
			};
		}

		const fullPath = join(root, normalizedPath);

		// Check file exists
		if (!existsSync(fullPath)) {
			return {
				success: false,
				output: `Error: File not found: ${normalizedPath}`,
			};
		}

		// Validate oldString is not empty
		if (input.oldString.length === 0) {
			return {
				success: false,
				output: "Error: oldString cannot be empty",
			};
		}

		try {
			// Read file content (also serves as original state for rollback)
			const content = readFileSync(fullPath, "utf-8");

			// Count occurrences
			const occurrences = countOccurrences(content, input.oldString);

			if (occurrences === 0) {
				return {
					success: false,
					output: "Error: oldString not found in file",
				};
			}

			if (occurrences > 1 && !input.replaceAll) {
				return {
					success: false,
					output: `Error: oldString found ${occurrences} times. Set replaceAll=true to replace all occurrences.`,
				};
			}

			// Perform replacement
			let newContent: string;
			if (input.replaceAll) {
				newContent = content.split(input.oldString).join(input.newString);
			} else {
				newContent = content.replace(input.oldString, input.newString);
			}

			// Write the file
			writeFileSync(fullPath, newContent, "utf-8");

			log.tools.info(
				`edit_file: ${normalizedPath} (${occurrences} replacement${occurrences > 1 ? "s" : ""})`,
			);

			// Execute post-write hooks
			const hookResult = await executePostWriteHooks(
				context.projectRoot,
				normalizedPath,
				root,
			);

			// If a blocking hook failed, rollback the file and return error
			if (hookResult.blocked) {
				// Rollback: restore original content
				writeFileSync(fullPath, content, "utf-8");
				return {
					success: false,
					output: `Hook failed (blocking), file reverted:\n${hookResult.output}`,
				};
			}

			// Check for type errors if it's a TypeScript file
			let diagnosticOutput = "";
			const diagnostics = await getDiagnostics(context, fullPath);
			if (diagnostics) {
				diagnosticOutput = `\n\n⚠️ Type errors:\n${diagnostics}`;
			}

			// Build output with hook output appended if non-empty
			let output = `Applied ${occurrences} edit${occurrences > 1 ? "s" : ""} to ${normalizedPath}${diagnosticOutput}`;
			if (hookResult.output) {
				output += `\n\n${hookResult.output}`;
			}

			clearTSProjectCache();

			return {
				success: true,
				output,
			};
		} catch (error) {
			return {
				success: false,
				output: `Error: ${error instanceof Error ? error.message : `Failed to edit file: ${normalizedPath}`}`,
			};
		}
	},
};
