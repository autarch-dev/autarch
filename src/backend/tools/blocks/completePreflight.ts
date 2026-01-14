/**
 * complete_preflight - Signal preflight environment setup is complete
 */

import { z } from "zod";
import type { ToolDefinition, ToolResult } from "../types";

// =============================================================================
// Schema
// =============================================================================

export const completePreflightInputSchema = z.object({
	summary: z.string().describe("Brief description of setup completed"),
	setupCommands: z
		.array(z.string())
		.describe("List of commands that were executed"),
	buildSuccess: z.boolean().describe("Whether the project builds successfully"),
	baselinesRecorded: z.number().describe("Count of baseline issues recorded"),
});

export type CompletePreflightInput = z.infer<
	typeof completePreflightInputSchema
>;

export interface CompletePreflightOutput {
	success: boolean;
}

// =============================================================================
// Tool Definition
// =============================================================================

export const completePreflightTool: ToolDefinition<
	CompletePreflightInput,
	CompletePreflightOutput
> = {
	name: "complete_preflight",
	description: `Signal preflight environment setup is complete.
Use after initializing dependencies and recording baselines.`,
	inputSchema: completePreflightInputSchema,
	execute: async (
		_input,
		_context,
	): Promise<ToolResult<CompletePreflightOutput>> => {
		return {
			success: true,
			data: { success: true },
		};
	},
};
