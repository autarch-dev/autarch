/**
 * add_todo - Add items to the todo list for the current context
 *
 * Todos have different scoping based on context:
 * - Channels: Todos persist across the entire channel lifetime
 * - Workflows: Todos are scoped to the current session
 */

import { z } from "zod";
import { getProjectDb } from "@/backend/db/project";
import { ids } from "@/backend/utils";
import type { SessionContextType } from "@/shared/schemas/session";
import {
	REASON_DESCRIPTION,
	type ToolDefinition,
	type ToolResult,
} from "../types";

// =============================================================================
// Schema
// =============================================================================

export const addTodoInputSchema = z.object({
	reason: z.string().describe(REASON_DESCRIPTION),
	items: z
		.array(
			z.object({
				title: z.string().describe("Short label for the todo item"),
				description: z
					.string()
					.describe("Detailed context about what this item involves"),
			}),
		)
		.min(1)
		.describe("Todo items to add"),
});

export type AddTodoInput = z.infer<typeof addTodoInputSchema>;

// =============================================================================
// Tool Definition
// =============================================================================

export const addTodoTool: ToolDefinition<AddTodoInput> = {
	name: "add_todo",
	description:
		"Add items to your todo list for tracking work progress. Items persist across turns and survive context compaction. Your todo list is automatically shown to you every turn.",
	inputSchema: addTodoInputSchema,
	execute: async (input, context): Promise<ToolResult> => {
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
				output: "Error: Todos require either a channel or workflow context",
			};
		}

		// Session ID is required for storing todos
		if (!context.sessionId) {
			return {
				success: false,
				output: "Error: No active session - cannot store todo",
			};
		}

		const sessionId = context.sessionId;

		// Get database connection
		const db = await getProjectDb(context.projectRoot);

		// Query current max sort_order for this context
		let maxSortOrder: number;
		try {
			const query = db
				.selectFrom("session_todos")
				.select((eb) => eb.fn.max("sort_order").as("max_sort"))
				.where("context_type", "=", contextType)
				.where("context_id", "=", contextId);

			// For workflows, also scope by session
			const result =
				contextType === "workflow"
					? await query.where("session_id", "=", sessionId).executeTakeFirst()
					: await query.executeTakeFirst();

			maxSortOrder = result?.max_sort != null ? Number(result.max_sort) : 0;
		} catch {
			maxSortOrder = 0;
		}

		// Insert all todo items in a transaction for atomicity
		const now = Date.now();
		const addedItems: Array<{ id: string; title: string }> = [];

		try {
			await db.transaction().execute(async (trx) => {
				for (const [i, item] of input.items.entries()) {
					const todoId = ids.todo();
					const sortOrder = maxSortOrder + 1 + i;

					await trx
						.insertInto("session_todos")
						.values({
							id: todoId,
							session_id: sessionId,
							context_type: contextType,
							context_id: contextId,
							title: item.title,
							description: item.description,
							checked: 0,
							sort_order: sortOrder,
							created_at: now,
						})
						.execute();

					addedItems.push({ id: todoId, title: item.title });
				}
			});
		} catch (err) {
			return {
				success: false,
				output: `Error: Failed to add todo items: ${err instanceof Error ? err.message : "unknown error"}`,
			};
		}

		const itemList = addedItems
			.map((item) => `- (${item.id}) ${item.title}`)
			.join("\n");

		return {
			success: true,
			output: `Added ${addedItems.length} todo item(s):\n${itemList}`,
		};
	},
};
