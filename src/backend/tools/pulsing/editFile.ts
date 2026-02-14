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
import { getDiagnostics } from "./diagnostics";
import {
	buildContextOutput,
	calculateReplacementPositions,
	positionsToLineRanges,
} from "./editContext";
import { executePostWriteHooks } from "./hooks";
import { clearTSProjectCache } from "./tsProject";
import { escapeReplacement } from "./util";

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
				newContent = content.replace(
					input.oldString,
					escapeReplacement(input.newString),
				);
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

			// Extract context for the applied replacements using tracked positions
			// Calculate positions based on original content, adjusted for the new content
			const replacementPositions = calculateReplacementPositions(
				content,
				input.oldString,
				input.newString,
				input.replaceAll,
			);
			const lineRanges = positionsToLineRanges(
				newContent,
				replacementPositions,
			);
			const contextOutput = buildContextOutput(
				normalizedPath,
				newContent,
				lineRanges,
			);

			// Check for type errors if it's a TypeScript file
			let diagnosticOutput = "";
			const diagnostics = await getDiagnostics(context, fullPath);
			if (diagnostics) {
				diagnosticOutput = `\n\n⚠️ Type errors:\n${diagnostics}`;
			}

			// Build output with hook output appended if non-empty
			let output = `Applied ${occurrences} edit${occurrences > 1 ? "s" : ""} to ${normalizedPath}${diagnosticOutput}`;
			if (contextOutput) {
				output += `\n\n${contextOutput}`;
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
