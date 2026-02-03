/**
 * multi_edit - Apply multiple exact string replacements to a file atomically
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

const editOperationSchema = z.object({
	oldString: z.string().describe("Exact content to match"),
	newString: z.string().describe("Replacement content"),
	replaceAll: z
		.boolean()
		.optional()
		.default(false)
		.describe("If true, replaces all occurrences (default: false)"),
});

export const multiEditInputSchema = z.object({
	reason: z.string().describe(REASON_DESCRIPTION),
	path: z.string().describe("Path to file, relative to worktree root"),
	edits: z
		.array(editOperationSchema)
		.min(1)
		.describe(
			"Array of edit operations to apply sequentially. Each edit has: oldString (exact content to match), newString (replacement content), replaceAll (optional, if true replaces all occurrences)",
		),
});

export type MultiEditInput = z.infer<typeof multiEditInputSchema>;

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

interface EditValidationResult {
	valid: boolean;
	error?: string;
	editIndex?: number;
}

/**
 * Validate all edits can be applied and simulate the result
 */
function validateEdits(
	content: string,
	edits: Array<{ oldString: string; newString: string; replaceAll?: boolean }>,
): EditValidationResult {
	let simulatedContent = content;

	for (const [i, edit] of edits.entries()) {
		// Check for empty oldString
		if (edit.oldString.length === 0) {
			return {
				valid: false,
				error: `Edit ${i}: oldString cannot be empty`,
				editIndex: i,
			};
		}

		// Count occurrences in current simulated state
		const occurrences = countOccurrences(simulatedContent, edit.oldString);

		if (occurrences === 0) {
			return {
				valid: false,
				error: `Edit ${i}: oldString not found`,
				editIndex: i,
			};
		}

		if (occurrences > 1 && !edit.replaceAll) {
			return {
				valid: false,
				error: `Edit ${i}: oldString found ${occurrences} times (set replaceAll=true to replace all)`,
				editIndex: i,
			};
		}

		// Apply the edit to simulated content
		if (edit.replaceAll) {
			simulatedContent = simulatedContent
				.split(edit.oldString)
				.join(edit.newString);
		} else {
			simulatedContent = simulatedContent.replace(
				edit.oldString,
				edit.newString,
			);
		}
	}

	return { valid: true };
}

/**
 * Find all occurrence positions of a substring in a string
 * Returns array of starting positions (0-indexed)
 */
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

export const multiEditTool: ToolDefinition<MultiEditInput> = {
	name: "multi_edit",
	description: `Apply **multiple exact string replacements** to a single file atomically.
More efficient than multiple edit_file calls when making several changes to the same file.

Edits are applied sequentially in array order, each operating on the result of the previous edit.
This allows overlapping or adjacent edits to work correctly.

All edits are validated before any are applied. If any edit fails validation:
- No changes are written to the file
- The tool reports which edit failed and why

Rules:
- You must read the target file with read_file before editing.
- Each oldString must match the file content exactly (at the time that edit is applied).
- Line number prefixes from read_file output must not be included in oldString or newString.
- Each edit has its own replaceAll parameter.

Failure is final: do not attempt fuzzy matching or retries.
Note: You are working in an isolated git worktree. Changes are isolated until pulse completion.`,
	inputSchema: multiEditInputSchema,
	execute: async (input, context): Promise<ToolResult> => {
		// Validate inputs
		if (input.edits.length === 0) {
			return {
				success: false,
				output: "Error: No edits provided",
			};
		}

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

		try {
			// Read file content (also serves as original state for rollback)
			const content = readFileSync(fullPath, "utf-8");

			// Validate all edits first
			const validation = validateEdits(content, input.edits);
			if (!validation.valid) {
				return {
					success: false,
					output: `Error: ${validation.error}`,
				};
			}

			// Apply all edits, tracking replacement positions for context output
			let newContent = content;
			const replacementRanges: Array<{ startLine: number; endLine: number }> =
				[];
			for (const edit of input.edits) {
				// Track positions before applying each edit (line numbers reference current content state)
				const positions = findAllOccurrencePositions(
					newContent,
					edit.oldString,
				);
				for (const position of positions) {
					const startLine = getLineNumber(newContent, position);
					const endLine = startLine + edit.newString.split("\n").length - 1;
					replacementRanges.push({ startLine, endLine });
				}

				// Apply the edit
				if (edit.replaceAll) {
					newContent = newContent.split(edit.oldString).join(edit.newString);
				} else {
					newContent = newContent.replace(edit.oldString, edit.newString);
				}
			}

			// Write the file
			writeFileSync(fullPath, newContent, "utf-8");

			log.tools.info(
				`multi_edit: ${normalizedPath} (${input.edits.length} edits applied)`,
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

			// Extract context with range merging
			let combinedContext = "";
			if (replacementRanges.length > 0) {
				// Sort ranges by startLine ascending
				const sortedRanges = [...replacementRanges].sort(
					(a, b) => a.startLine - b.startLine,
				);

				// Merge consecutive ranges where gap <= 10 lines
				const mergedRanges: Array<{ startLine: number; endLine: number }> = [];
				let currentRange: { startLine: number; endLine: number } | null = null;

				for (const range of sortedRanges) {
					if (currentRange === null) {
						currentRange = {
							startLine: range.startLine,
							endLine: range.endLine,
						};
					} else if (currentRange.endLine + 10 >= range.startLine) {
						// Merge: extend currentRange.endLine to include range
						currentRange.endLine = Math.max(
							currentRange.endLine,
							range.endLine,
						);
					} else {
						// No merge: push currentRange and start new one
						mergedRanges.push(currentRange);
						currentRange = {
							startLine: range.startLine,
							endLine: range.endLine,
						};
					}
				}
				if (currentRange !== null) {
					mergedRanges.push(currentRange);
				}

				// Split final content into lines for context extraction
				const contentLines = newContent.split("\n");

				// Extract and format context for each merged range
				const contextBlocks: string[] = [];
				for (const range of mergedRanges) {
					const extracted = extractContextLines(
						contentLines,
						range.startLine,
						range.endLine,
						5,
					);
					const formatted = formatContextOutput(
						normalizedPath,
						extracted.actualStart,
						extracted.actualEnd,
						extracted.lines,
					);
					contextBlocks.push(formatted);
				}

				// Combine all context blocks with double newline separator
				combinedContext = contextBlocks.join("\n\n");
			}

			// Build output with hook output appended if non-empty
			let output = `Applied ${input.edits.length} edits to ${normalizedPath}${diagnosticOutput}`;
			if (combinedContext) {
				output += `\n\n${combinedContext}`;
			}
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
