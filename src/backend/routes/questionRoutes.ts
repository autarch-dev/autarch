/**
 * Question API Routes
 *
 * Routes for answering agent-asked questions.
 * Uses ConversationRepository for all DB operations with safe JSON handling.
 */

import { z } from "zod";
import { createQuestionsAnsweredEvent } from "@/shared/schemas/events";
import type { AnswerQuestionsResponse } from "@/shared/schemas/questions";
import { AgentRunner, getSessionManager } from "../agents/runner";
import { findRepoRoot } from "../git";
import { log } from "../logger";
import { getRepositories } from "../repositories";
import { broadcast } from "../ws";

// =============================================================================
// Schemas
// =============================================================================

const IdParamSchema = z.object({
	id: z.string().min(1),
});

const AnswerQuestionRequestSchema = z.object({
	answer: z.unknown(),
});

const AnswerQuestionsRequestSchema = z.object({
	answers: z.array(
		z.object({
			questionId: z.string(),
			answer: z.unknown(),
		}),
	),
	/** Optional additional comment/feedback from the user */
	comment: z.string().optional(),
});

// =============================================================================
// Helpers
// =============================================================================

/**
 * Parse and validate route params with Zod.
 */
function parseParams<T extends z.ZodTypeAny>(
	// biome-ignore lint/suspicious/noExplicitAny: Bun adds params to Request
	req: Request & { params?: any },
	schema: T,
): z.infer<T> | null {
	const result = schema.safeParse(req.params);
	if (!result.success) {
		return null;
	}
	return result.data;
}

// =============================================================================
// Routes
// =============================================================================

export const questionRoutes = {
	"/api/questions/:id/answer": {
		async POST(req: Request) {
			const params = parseParams(req, IdParamSchema);
			if (!params) {
				return Response.json({ error: "Invalid question ID" }, { status: 400 });
			}
			const questionId = params.id;

			try {
				const body = await req.json();
				const parsed = AnswerQuestionRequestSchema.safeParse(body);

				if (!parsed.success) {
					return Response.json(
						{
							error: "Invalid request",
							details: z.prettifyError(parsed.error),
						},
						{ status: 400 },
					);
				}

				const projectRoot = findRepoRoot(process.cwd());
				const repos = getRepositories();

				// Get the question via repository
				const question = await repos.conversations.getQuestionById(questionId);

				if (!question) {
					return Response.json(
						{ error: "Question not found" },
						{ status: 404 },
					);
				}

				if (question.status === "answered") {
					return Response.json(
						{ error: "Question already answered" },
						{ status: 400 },
					);
				}

				// Answer the question via repository (uses safe JSON serialization)
				await repos.conversations.answerQuestion(
					questionId,
					parsed.data.answer,
				);

				// Broadcast the answer event
				broadcast(
					createQuestionsAnsweredEvent({
						sessionId: question.session_id,
						turnId: question.turn_id,
						questionId,
						answer: parsed.data.answer,
					}),
				);

				// Check if all questions for this turn are answered
				const pendingQuestions =
					await repos.conversations.getPendingQuestionsByTurn(question.turn_id);
				const allAnswered = pendingQuestions.length === 0;

				// If all questions are answered, auto-resume the agent
				if (allAnswered) {
					// Get all questions for this turn to format the answer message
					const allQuestions = await repos.conversations.getQuestionsByTurn(
						question.turn_id,
					);

					// Format answers using repository helper (safe JSON parsing)
					const answerMessage =
						repos.conversations.formatAnsweredQuestionsMessage(allQuestions);

					// Get session and send the answer message
					const sessionManager = getSessionManager();
					const session = await sessionManager.getOrRestoreSession(
						question.session_id,
					);

					if (session && session.status === "active") {
						const runner = new AgentRunner(session, {
							projectRoot,
							conversationRepo: repos.conversations,
						});

						log.api.info(
							`All questions answered, resuming session ${question.session_id}`,
						);

						// Run in background (non-blocking)
						runner.run(answerMessage).catch((error) => {
							log.agent.error(
								`Agent run failed after answers for session ${question.session_id}:`,
								error,
							);
							sessionManager.errorSession(
								question.session_id,
								error instanceof Error ? error.message : "Unknown error",
							);
						});
					}
				}

				const response: AnswerQuestionsResponse = {
					success: true,
					answeredCount: 1,
					allAnswered,
					sessionResumed: allAnswered,
				};

				return Response.json(response);
			} catch (error) {
				log.api.error("Failed to answer question:", error);
				return Response.json(
					{ error: error instanceof Error ? error.message : "Unknown error" },
					{ status: 500 },
				);
			}
		},
	},

	"/api/questions/batch-answer": {
		async POST(req: Request) {
			try {
				const body = await req.json();
				const parsed = AnswerQuestionsRequestSchema.safeParse(body);

				if (!parsed.success) {
					return Response.json(
						{
							error: "Invalid request",
							details: z.prettifyError(parsed.error),
						},
						{ status: 400 },
					);
				}

				const projectRoot = findRepoRoot(process.cwd());
				const repos = getRepositories();

				let sessionId: string | null = null;
				let turnId: string | null = null;
				let answeredCount = 0;
				const { answers, comment } = parsed.data;

				// Process each answer
				for (const { questionId, answer } of answers) {
					const question =
						await repos.conversations.getQuestionById(questionId);

					if (!question || question.status === "answered") {
						continue;
					}

					// Track session/turn for later
					sessionId = question.session_id;
					turnId = question.turn_id;

					// Answer the question via repository (uses safe JSON serialization)
					await repos.conversations.answerQuestion(questionId, answer);

					// Broadcast the answer event
					broadcast(
						createQuestionsAnsweredEvent({
							sessionId: question.session_id,
							turnId: question.turn_id,
							questionId,
							answer,
						}),
					);

					answeredCount++;
				}

				// If no questions were answered, try to get session/turn from first pending question
				if (!sessionId || !turnId) {
					const firstAnswer = answers[0];
					if (firstAnswer) {
						const firstQuestion = await repos.conversations.getQuestionById(
							firstAnswer.questionId,
						);
						if (firstQuestion) {
							sessionId = firstQuestion.session_id;
							turnId = firstQuestion.turn_id;
						}
					}

					if (!sessionId || !turnId) {
						return Response.json(
							{ error: "No valid questions to answer" },
							{ status: 400 },
						);
					}
				}

				// Mark any remaining pending questions as "skipped"
				await repos.conversations.skipPendingQuestions(turnId);

				// All questions are now processed
				const allAnswered = true;

				// Auto-resume the agent with the user's responses
				if (allAnswered) {
					const allQuestions =
						await repos.conversations.getQuestionsByTurn(turnId);

					// Format answers using repository helper (safe JSON parsing)
					const answerMessage =
						repos.conversations.formatAnsweredQuestionsMessage(
							allQuestions,
							comment,
						);

					// Get session and send the answer message
					const sessionManager = getSessionManager();
					const session = await sessionManager.getOrRestoreSession(sessionId);

					if (session && session.status === "active") {
						const runner = new AgentRunner(session, {
							projectRoot,
							conversationRepo: repos.conversations,
						});

						log.api.info(
							`All questions answered (batch), resuming session ${sessionId}`,
						);

						// Run in background (non-blocking)
						runner.run(answerMessage).catch((error) => {
							log.agent.error(
								`Agent run failed after answers for session ${sessionId}:`,
								error,
							);
							sessionManager.errorSession(
								sessionId as string,
								error instanceof Error ? error.message : "Unknown error",
							);
						});
					}
				}

				const response: AnswerQuestionsResponse = {
					success: true,
					answeredCount,
					allAnswered,
					sessionResumed: allAnswered,
				};

				return Response.json(response);
			} catch (error) {
				log.api.error("Failed to batch answer questions:", error);
				return Response.json(
					{ error: error instanceof Error ? error.message : "Unknown error" },
					{ status: 500 },
				);
			}
		},
	},
};
