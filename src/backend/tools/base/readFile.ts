/**
 * read_file - Read contents of a file from the repository
 */

import { z } from "zod";
import {
	REASON_DESCRIPTION,
	type ToolDefinition,
	type ToolResult,
} from "../types";
import { isSensitiveFile, resolveSafePath } from "./utils";

// =============================================================================
// Schema
// =============================================================================

export const readFileInputSchema = z.object({
	reason: z.string().describe(REASON_DESCRIPTION),
	path: z.string().describe("Path to file, relative to project root"),
	startLine: z
		.number()
		.int()
		.positive()
		.nullable()
		.optional()
		.describe("Optional start line (1-indexed, inclusive)"),
	endLine: z
		.number()
		.int()
		.positive()
		.nullable()
		.optional()
		.describe("Optional end line (1-indexed, inclusive)"),
});

export type ReadFileInput = z.infer<typeof readFileInputSchema>;

export type ReadFileOutput = string;

// =============================================================================
// Tool Definition
// =============================================================================

export const readFileTool: ToolDefinition<ReadFileInput, ReadFileOutput> = {
	name: "read_file",
	description: `Read the contents of a file from the repository.
Can optionally specify a line range to read only a portion of the file.
Some files may be blocked due to sensitive content policies.`,
	inputSchema: readFileInputSchema,
	execute: async (input, context): Promise<ToolResult<ReadFileOutput>> => {
		// Resolve and validate path
		const absolutePath = resolveSafePath(context.projectRoot, input.path);
		if (!absolutePath) {
			return {
				success: false,
				error: `Invalid path: ${input.path} - path must be within project root`,
				blocked: true,
				reason: "Path escapes project root",
			};
		}

		// Check sensitivity gate
		if (isSensitiveFile(input.path)) {
			return {
				success: false,
				error: `Cannot read sensitive file: ${input.path}`,
				blocked: true,
				reason: "File matches sensitive content patterns",
			};
		}

		// Check if file exists
		const file = Bun.file(absolutePath);
		const exists = await file.exists();
		if (!exists) {
			return {
				success: false,
				error: `File not found: ${input.path}`,
			};
		}

		// Read file content
		let content: string;
		try {
			content = await file.text();
		} catch (err) {
			return {
				success: false,
				error: `Failed to read file: ${input.path} - ${err instanceof Error ? err.message : "unknown error"}`,
			};
		}

		// Apply line range if specified
		if (input.startLine != null || input.endLine != null) {
			const lines = content.split("\n");
			const start = (input.startLine ?? 1) - 1; // Convert to 0-indexed
			const end = input.endLine ?? lines.length;

			if (start < 0 || start >= lines.length) {
				return {
					success: false,
					error: `Invalid start line: ${input.startLine} (file has ${lines.length} lines)`,
				};
			}

			if (end < start) {
				return {
					success: false,
					error: `Invalid line range: end (${input.endLine}) < start (${input.startLine})`,
				};
			}

			content = lines.slice(start, end).join("\n");
		}

		return {
			success: true,
			data: content,
		};
	},
};
