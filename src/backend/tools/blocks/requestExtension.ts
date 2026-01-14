/**
 * request_extension - Request additional execution time
 */

import { z } from "zod";
import type { ToolDefinition, ToolResult } from "../types";

// =============================================================================
// Schema
// =============================================================================

export const requestExtensionInputSchema = z.object({
	reason: z.string().describe("Why additional time/exploration is required"),
	completed: z
		.array(z.string())
		.describe("Concrete work already completed in this turn"),
	remaining: z.array(z.string()).describe("Concrete work still required"),
});

export type RequestExtensionInput = z.infer<typeof requestExtensionInputSchema>;

export interface RequestExtensionOutput {
	success: boolean;
}

// =============================================================================
// Tool Definition
// =============================================================================

export const requestExtensionTool: ToolDefinition<
	RequestExtensionInput,
	RequestExtensionOutput
> = {
	name: "request_extension",
	description: `Request additional execution time. Used as a yield point to pause execution.
When emitted, the agent pauses execution, allows context compaction, and continues in a subsequent turn.`,
	inputSchema: requestExtensionInputSchema,
	execute: async (
		_input,
		_context,
	): Promise<ToolResult<RequestExtensionOutput>> => {
		return {
			success: true,
			data: { success: true },
		};
	},
};
