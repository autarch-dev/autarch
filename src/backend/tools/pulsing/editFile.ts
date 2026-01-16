/**
 * edit_file - Apply exact string replacement in a file
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, join, normalize } from "node:path";
import { z } from "zod";
import { log } from "@/backend/logger";
import {
	REASON_DESCRIPTION,
	type ToolDefinition,
	type ToolResult,
} from "../types";

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
		// Determine the root to use
		const root = context.worktreePath ?? context.projectRoot;

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
			// Read file content
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

			return {
				success: true,
				output: `Applied ${occurrences} replacement${occurrences > 1 ? "s" : ""} to ${normalizedPath}`,
			};
		} catch (error) {
			return {
				success: false,
				output: `Error: ${error instanceof Error ? error.message : `Failed to edit file: ${normalizedPath}`}`,
			};
		}
	},
};
