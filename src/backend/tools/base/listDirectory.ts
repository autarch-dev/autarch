/**
 * list_directory - List files and directories at a path
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

export const listDirectoryInputSchema = z.object({
	reason: z.string().describe(REASON_DESCRIPTION),
	path: z
		.string()
		.optional()
		.default(".")
		.describe("Path relative to project root (empty or '.' for root)"),
	depth: z
		.number()
		.int()
		.positive()
		.nullable()
		.optional()
		.default(1)
		.describe(
			"Maximum depth to traverse (1 = immediate children, null = unlimited)",
		),
	type: z
		.enum(["files", "directories", "all"])
		.optional()
		.default("all")
		.describe("Type of entries: 'files', 'directories', or 'all'"),
	glob: z
		.string()
		.nullable()
		.optional()
		.describe(
			"Optional glob pattern to filter results, e.g. '**/*.cs' for all C# files",
		),
});

export type ListDirectoryInput = z.infer<typeof listDirectoryInputSchema>;

export interface DirectoryEntry {
	path: string;
	is_directory: boolean;
	depth: number;
}

export type ListDirectoryOutput = DirectoryEntry[];

// =============================================================================
// Tool Definition
// =============================================================================

export const listDirectoryTool: ToolDefinition<
	ListDirectoryInput,
	ListDirectoryOutput
> = {
	name: "list_directory",
	description: `List files and directories at a given path.
Respects .gitignore and .autarchignore rules.
Returns entries with their type (file or directory) and relative path.

- depth controls how deep to traverse (1 = immediate children, 2 = children + grandchildren, null = unlimited - defaults to 1)
- type filters results: 'files' (only files), 'directories' (only dirs), 'all' (both) - defaults to 'all'
- optionally, a glob pattern can be used to filter results, e.g. "**/*.cs" for all C# files`,
	inputSchema: listDirectoryInputSchema,
	execute: async (input, context): Promise<ToolResult<ListDirectoryOutput>> => {
		// TODO: Implement directory listing
		// - Resolve path relative to context.projectRoot
		// - Respect .gitignore and .autarchignore
		// - Apply depth and type filters

		return {
			success: false,
			error: `Directory not found: ${input.path}`,
		};
	},
};
