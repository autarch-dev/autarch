/**
 * write_file - Write content to a file in the worktree
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

export const writeFileInputSchema = z.object({
	reason: z.string().describe(REASON_DESCRIPTION),
	path: z.string().describe("Path to file, relative to worktree root"),
	content: z.string().describe("Content to write to the file"),
});

export type WriteFileInput = z.infer<typeof writeFileInputSchema>;

export interface WriteFileOutput {
	success: boolean;
	path: string;
	bytes_written: number;
}

// =============================================================================
// Tool Definition
// =============================================================================

export const writeFileTool: ToolDefinition<WriteFileInput, WriteFileOutput> = {
	name: "write_file",
	description: `Write content to a file in the worktree.
Creates the file if it doesn't exist, or overwrites if it does.
Parent directories are created automatically.

Note: You are working in an isolated git worktree. Changes are isolated until pulse completion.`,
	inputSchema: writeFileInputSchema,
	execute: async (input, context): Promise<ToolResult<WriteFileOutput>> => {
		// TODO: Implement file writing
		// - Write to context.worktreePath
		// - Create parent directories
		// - Track changes for review

		return {
			success: false,
			error: "write_file not implemented",
		};
	},
};
