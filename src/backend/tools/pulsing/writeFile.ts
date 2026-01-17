/**
 * write_file - Write content to a file in the worktree
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, normalize } from "node:path";
import { z } from "zod";
import { log } from "@/backend/logger";
import { getEffectiveRoot } from "../base/utils";
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

// =============================================================================
// Tool Definition
// =============================================================================

export const writeFileTool: ToolDefinition<WriteFileInput> = {
	name: "write_file",
	description: `Write content to a file in the worktree.
Creates the file if it doesn't exist, or overwrites if it does.
Parent directories are created automatically.

Note: You are working in an isolated git worktree. Changes are isolated until pulse completion.`,
	inputSchema: writeFileInputSchema,
	execute: async (input, context): Promise<ToolResult> => {
		// Use worktree path if available (for pulsing agent isolation)
		const root = getEffectiveRoot(context);

		// Validate path is not absolute and doesn't escape the root
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

		try {
			// Create parent directories if needed
			const dir = dirname(fullPath);
			mkdirSync(dir, { recursive: true });

			// Write the file
			writeFileSync(fullPath, input.content, "utf-8");

			const bytesWritten = Buffer.byteLength(input.content, "utf-8");
			log.tools.info(`write_file: ${normalizedPath} (${bytesWritten} bytes)`);

			return {
				success: true,
				output: `Wrote ${bytesWritten} bytes to ${normalizedPath}`,
			};
		} catch (error) {
			return {
				success: false,
				output: `Error: ${error instanceof Error ? error.message : `Failed to write file: ${normalizedPath}`}`,
			};
		}
	},
};
