/**
 * take_note - Store a note for the current context
 *
 * Notes have different scoping based on context:
 * - Channels: Notes persist across the entire channel lifetime
 * - Workflows: Notes are ephemeral per stage (cleared on stage transition)
 */

import { z } from "zod";
import { getProjectDb } from "@/backend/db/project";
import type { SessionContextType } from "@/shared/schemas/session";
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
	note: z.string().min(1).describe("The note content to store"),
});

export type TakeNoteInput = z.infer<typeof takeNoteInputSchema>;

export interface TakeNoteOutput {
	noteId: string;
	noteCount: number;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Generate a unique note ID
 */
function generateNoteId(): string {
	const timestamp = Date.now().toString(36);
	const random = Math.random().toString(36).slice(2, 8);
	return `note_${timestamp}_${random}`;
}

// =============================================================================
// Tool Definition
// =============================================================================

export const takeNoteTool: ToolDefinition<TakeNoteInput, TakeNoteOutput> = {
	name: "take_note",
	description: `Store a note for yourself to remember. Notes will disappear when your conversation ends. The user can never see them.`,
	inputSchema: takeNoteInputSchema,
	execute: async (input, context): Promise<ToolResult<TakeNoteOutput>> => {
		// Determine context type and ID
		let contextType: SessionContextType;
		let contextId: string;

		if (context.channelId) {
			contextType = "channel";
			contextId = context.channelId;
		} else if (context.workflowId) {
			contextType = "workflow";
			contextId = context.workflowId;
		} else {
			return {
				success: false,
				error: "Notes require either a channel or workflow context",
			};
		}

		// Session ID is required for storing notes
		if (!context.sessionId) {
			return {
				success: false,
				error: "No active session - cannot store note",
			};
		}

		// Get database connection
		const db = await getProjectDb(context.projectRoot);

		// Generate note ID and timestamp
		const noteId = generateNoteId();
		const now = Date.now();

		// Insert the note
		try {
			await db
				.insertInto("session_notes")
				.values({
					id: noteId,
					session_id: context.sessionId,
					context_type: contextType,
					context_id: contextId,
					content: input.note,
					created_at: now,
				})
				.execute();
		} catch (err) {
			return {
				success: false,
				error: `Failed to store note: ${err instanceof Error ? err.message : "unknown error"}`,
			};
		}

		// Count total notes for this context
		// For channels: count by context (persists across sessions)
		// For workflows: count by session (ephemeral per stage)
		let noteCount: number;
		try {
			if (contextType === "channel") {
				const result = await db
					.selectFrom("session_notes")
					.select((eb) => eb.fn.countAll().as("count"))
					.where("context_type", "=", "channel")
					.where("context_id", "=", contextId)
					.executeTakeFirst();
				noteCount = Number(result?.count ?? 0);
			} else {
				const result = await db
					.selectFrom("session_notes")
					.select((eb) => eb.fn.countAll().as("count"))
					.where("session_id", "=", context.sessionId)
					.executeTakeFirst();
				noteCount = Number(result?.count ?? 0);
			}
		} catch {
			noteCount = 1; // Fallback if count fails
		}

		return {
			success: true,
			data: {
				noteId,
				noteCount,
			},
		};
	},
};
