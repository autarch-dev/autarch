/**
 * ask_questions - Ask structured questions requiring user input
 */

import { z } from "zod";
import type { ToolDefinition, ToolResult } from "../types";

// =============================================================================
// Schema
// =============================================================================

const questionSchema = z.object({
	type: z.enum(["single_select", "multi_select", "ranked", "free_text"]),
	prompt: z.string(),
	options: z.array(z.string()).optional(),
});

export const askQuestionsInputSchema = z.object({
	questions: z.array(questionSchema).describe("Array of structured questions"),
});

export type AskQuestionsInput = z.infer<typeof askQuestionsInputSchema>;

export interface AskQuestionsOutput {
	success: boolean;
}

// =============================================================================
// Tool Definition
// =============================================================================

export const askQuestionsTool: ToolDefinition<
	AskQuestionsInput,
	AskQuestionsOutput
> = {
	name: "ask_questions",
	description: `Ask structured questions requiring user input.
Use when the agent cannot proceed without explicit user decisions.
Questions are a terminal yield — no work after asking.`,
	inputSchema: askQuestionsInputSchema,
	execute: async (
		_input,
		_context,
	): Promise<ToolResult<AskQuestionsOutput>> => {
		return {
			success: true,
			data: { success: true },
		};
	},
};
