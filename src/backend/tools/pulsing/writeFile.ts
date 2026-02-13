/**
 * write_file - Write content to a file in the worktree
 */

import {
	existsSync,
	mkdirSync,
	readFileSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, normalize } from "node:path";
import { z } from "zod";
import { log } from "@/backend/logger";
import { getEffectiveRoot } from "../base/utils";
import {
	REASON_DESCRIPTION,
	type ToolDefinition,
	type ToolResult,
} from "../types";
import { getDiagnosticsThreadPool } from "./diagnostics";
import { executePostWriteHooks } from "./hooks";
import { clearTSProjectCache } from "./tsProject";

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
			// Save original state for rollback if blocking hook fails
			const fileExisted = existsSync(fullPath);
			const originalContent = fileExisted
				? readFileSync(fullPath, "utf-8")
				: null;

			// Create parent directories if needed
			const dir = dirname(fullPath);
			mkdirSync(dir, { recursive: true });

			// Write the file
			writeFileSync(fullPath, input.content, "utf-8");

			const bytesWritten = Buffer.byteLength(input.content, "utf-8");
			log.tools.info(`write_file: ${normalizedPath} (${bytesWritten} bytes)`);

			// Execute post-write hooks
			const hookResult = await executePostWriteHooks(
				context.projectRoot,
				normalizedPath,
				root,
			);

			// If a blocking hook failed, rollback the file and return error
			if (hookResult.blocked) {
				// Rollback: restore original content or delete the file if it was new
				if (originalContent !== null) {
					writeFileSync(fullPath, originalContent, "utf-8");
				} else {
					unlinkSync(fullPath);
				}
				return {
					success: false,
					output: `Hook failed (blocking), file reverted:\n${hookResult.output}`,
				};
			}

			// Check for type errors if it's a TypeScript file
			let diagnosticOutput = "";
			const diagnostics = await getDiagnosticsThreadPool.run(context, fullPath);
			if (diagnostics) {
				diagnosticOutput = `\n\n⚠️ Type errors:\n${diagnostics}`;
			}

			// Build output with hook output appended if non-empty
			let output = `Wrote ${bytesWritten} bytes to ${normalizedPath}${diagnosticOutput}`;
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
				output: `Error: ${error instanceof Error ? error.message : `Failed to write file: ${normalizedPath}`}`,
			};
		}
	},
};
