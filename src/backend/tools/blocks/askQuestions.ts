/**
 * ask_questions - Ask structured questions requiring user input
 *
 * Persists questions to the database and broadcasts an event to the frontend.
 * The agent will wait for the user to answer all questions before continuing.
 */

import { z } from "zod";
import { getProjectDb } from "@/backend/db/project";
import { ids } from "@/backend/utils";
import { broadcast } from "@/backend/ws";
import { createQuestionsAskedEvent } from "@/shared/schemas/events";
import {
	QuestionInputSchema,
	type QuestionType,
} from "@/shared/schemas/questions";
import type { ToolDefinition, ToolResult } from "../types";

// =============================================================================
// Schema
// =============================================================================

export const askQuestionsInputSchema = z.object({
	questions: z
		.array(QuestionInputSchema)
		.describe("Array of structured questions"),
});

export type AskQuestionsInput = z.infer<typeof askQuestionsInputSchema>;

// =============================================================================
// Tool Definition
// =============================================================================

export const askQuestionsTool: ToolDefinition<AskQuestionsInput> = {
	name: "ask_questions",
	description:
		"Ask structured questions requiring user input. Use when directed by the system prompt.",
	inputSchema: askQuestionsInputSchema,
	execute: async (input, context): Promise<ToolResult> => {
		// Session ID is required for storing questions
		if (!context.sessionId) {
			return {
				success: false,
				output: "Error: No active session - cannot store questions",
			};
		}

		// Get database connection
		const db = await getProjectDb(context.projectRoot);

		// Get the current turn for this session (most recent assistant turn)
		const currentTurn = await db
			.selectFrom("turns")
			.select(["id"])
			.where("session_id", "=", context.sessionId)
			.where("role", "=", "assistant")
			.orderBy("turn_index", "desc")
			.limit(1)
			.executeTakeFirst();

		if (!currentTurn) {
			return {
				success: false,
				output: "Error: No active turn found - cannot store questions",
			};
		}

		const turnId = currentTurn.id;
		const now = Date.now();
		const questionIds: string[] = [];
		const questionsForEvent: Array<{
			id: string;
			questionIndex: number;
			type: QuestionType;
			prompt: string;
			options?: string[];
		}> = [];

		// Insert each question
		for (let i = 0; i < input.questions.length; i++) {
			const question = input.questions[i];
			if (!question) continue;

			const questionId = ids.question();
			questionIds.push(questionId);

			try {
				await db
					.insertInto("questions")
					.values({
						id: questionId,
						session_id: context.sessionId,
						turn_id: turnId,
						question_index: i,
						type: question.type,
						prompt: question.prompt,
						options_json: question.options
							? JSON.stringify(question.options)
							: null,
						answer_json: null,
						status: "pending",
						created_at: now,
						answered_at: null,
					})
					.execute();

				questionsForEvent.push({
					id: questionId,
					questionIndex: i,
					type: question.type,
					prompt: question.prompt,
					options: question.options,
				});
			} catch (err) {
				return {
					success: false,
					output: `Error: Failed to store question: ${err instanceof Error ? err.message : "unknown error"}`,
				};
			}
		}

		// Broadcast questions:asked event
		broadcast(
			createQuestionsAskedEvent({
				sessionId: context.sessionId,
				turnId,
				questions: questionsForEvent,
			}),
		);

		return {
			success: true,
			output: `Asked ${questionIds.length} question(s). Waiting for user response.`,
		};
	},
};
