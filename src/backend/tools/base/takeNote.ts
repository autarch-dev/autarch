/**
 * take_note - Store a note for the current workflow stage
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

export const takeNoteInputSchema = z.object({
	reason: z.string().describe(REASON_DESCRIPTION),
	note: z
		.string()
		.min(1)
		.describe("The note content to store for the current workflow stage"),
});

export type TakeNoteInput = z.infer<typeof takeNoteInputSchema>;

export interface TakeNoteOutput {
	success: boolean;
}

// =============================================================================
// Tool Definition
// =============================================================================

export const takeNoteTool: ToolDefinition<TakeNoteInput, TakeNoteOutput> = {
	name: "take_note",
	description: `Store a note for yourself to remember. Notes will disappear when your conversation ends. The user can never see them.`,
	inputSchema: takeNoteInputSchema,
	execute: async (input, context): Promise<ToolResult<TakeNoteOutput>> => {
		// TODO: Implement note storage
		// - Validate workflow context
		// - Store note in database
		// - Notes cleared on stage transition

		if (!context.workflowId) {
			return {
				success: false,
				error: "Notes are only available in workflow channels",
			};
		}

		return {
			success: true,
			data: { success: true },
		};
	},
};
