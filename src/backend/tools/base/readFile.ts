/**
 * read_file - Read contents of a file from the repository
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
		// TODO: Implement file reading
		// - Resolve path relative to context.projectRoot
		// - Check sensitivity gate
		// - Apply line range if specified
		// - Return content

		return {
			success: false,
			error: `File not found: ${input.path}`,
		};
	},
};
