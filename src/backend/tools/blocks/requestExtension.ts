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

// =============================================================================
// Tool Definition
// =============================================================================

export const requestExtensionTool: ToolDefinition<RequestExtensionInput> = {
	name: "request_extension",
	description: `Request additional execution time. Used as a yield point to pause execution.
When emitted, the agent pauses execution, allows context compaction, and continues in a subsequent turn.

Usage:
{
	"reason": "Why additional time is required",
	"completed": ["Concrete work already done"],
	"remaining": ["Concrete work still needed"]
}

_No_ markdown lists. Just JSON.
`,
	inputSchema: requestExtensionInputSchema,
	execute: async (_input, _context): Promise<ToolResult> => {
		return {
			success: true,
			output: "Extension request pending. You *MUST STOP* and allow the user to respond.",
		};
	},
};
