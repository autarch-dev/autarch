/**
 * check_todo - Mark todo items as completed by their IDs
 *
 * Updates the checked status of todo items in the current context.
 */

import { z } from "zod";
import { getProjectDb } from "@/backend/db/project";
import {
	REASON_DESCRIPTION,
	type ToolDefinition,
	type ToolResult,
} from "../types";

// =============================================================================
// Schema
// =============================================================================

export const checkTodoInputSchema = z.object({
	reason: z.string().describe(REASON_DESCRIPTION),
	ids: z
		.array(z.string())
		.min(1)
		.describe("IDs of todo items to mark as completed"),
});

export type CheckTodoInput = z.infer<typeof checkTodoInputSchema>;

// =============================================================================
// Tool Definition
// =============================================================================

export const checkTodoTool: ToolDefinition<CheckTodoInput> = {
	name: "check_todo",
	description:
		"Mark todo items as completed by their IDs. IDs are shown in parentheses in your todo list.",
	inputSchema: checkTodoInputSchema,
	execute: async (input, context): Promise<ToolResult> => {
		// Get database connection
		const db = await getProjectDb(context.projectRoot);

		const checkedIds: string[] = [];

		try {
			for (const todoId of input.ids) {
				const result = await db
					.updateTable("session_todos")
					.set({ checked: 1 })
					.where("id", "=", todoId)
					.executeTakeFirst();

				if (result.numUpdatedRows > 0n) {
					checkedIds.push(todoId);
				}
			}
		} catch (err) {
			return {
				success: false,
				output: `Error: Failed to check todo items: ${err instanceof Error ? err.message : "unknown error"}`,
			};
		}

		if (checkedIds.length === 0) {
			return {
				success: false,
				output: "Error: No matching todo items found for the provided IDs",
			};
		}

		const idList = checkedIds.map((id) => `- ${id}`).join("\n");

		return {
			success: true,
			output: `Checked off ${checkedIds.length} todo item(s):\n${idList}`,
		};
	},
};
