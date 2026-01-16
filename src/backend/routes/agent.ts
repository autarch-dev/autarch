/**
 * Agent API Routes
 *
 * Routes for managing workflows, channels, sessions, and agent interactions.
 * Uses Bun's native dynamic route syntax (:param) for path parameters.
 */

import { z } from "zod";
import {
	type Channel,
	type ChannelHistoryResponse,
	type ChannelMessage,
	CreateChannelRequestSchema,
} from "@/shared/schemas/channel";
import {
	createChannelCreatedEvent,
	createChannelDeletedEvent,
	createQuestionsAnsweredEvent,
} from "@/shared/schemas/events";
import type { AnswerQuestionsResponse } from "@/shared/schemas/questions";
import {
	AgentRunner,
	getSessionManager,
	getWorkflowOrchestrator,
} from "../agents/runner";
import { getProjectDb } from "../db/project";
import { findRepoRoot } from "../git";
import { log } from "../logger";
import { broadcast } from "../ws";

// =============================================================================
// Request Schemas
// =============================================================================

const CreateWorkflowRequestSchema = z.object({
	title: z.string().min(1),
	description: z.string().optional(),
	priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
});

const SendMessageRequestSchema = z.object({
	content: z.string().min(1),
});

const RequestChangesRequestSchema = z.object({
	feedback: z.string().min(1),
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
});

/** Schema for routes with :id param */
const IdParamSchema = z.object({
	id: z.string().min(1),
});

// =============================================================================
// Helpers
// =============================================================================

function generateChannelId(): string {
	return `ch_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Parse and validate route params with Zod.
 * Returns null and sends error response if validation fails.
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
// Route Definitions
// =============================================================================

export const agentRoutes = {
	// =========================================================================
	// Workflow Routes
	// =========================================================================

	"/api/workflows": {
		async POST(req: Request) {
			try {
				const body = await req.json();
				const parsed = CreateWorkflowRequestSchema.safeParse(body);

				if (!parsed.success) {
					return Response.json(
						{ error: "Invalid request", details: parsed.error.flatten() },
						{ status: 400 },
					);
				}

				const orchestrator = getWorkflowOrchestrator();
				const workflow = await orchestrator.createWorkflow(
					parsed.data.title,
					parsed.data.description,
					parsed.data.priority,
				);

				return Response.json(workflow, { status: 201 });
			} catch (error) {
				log.api.error("Failed to create workflow:", error);
				return Response.json(
					{ error: error instanceof Error ? error.message : "Unknown error" },
					{ status: 500 },
				);
			}
		},

		async GET(_req: Request) {
			try {
				const projectRoot = findRepoRoot(process.cwd());
				const db = await getProjectDb(projectRoot);

				const workflows = await db
					.selectFrom("workflows")
					.selectAll()
					.orderBy("updated_at", "desc")
					.execute();

				return Response.json(
					workflows.map((w) => ({
						id: w.id,
						title: w.title,
						description: w.description,
						status: w.status,
						priority: w.priority,
						awaitingApproval: w.awaiting_approval === 1,
						pendingArtifactType: w.pending_artifact_type,
						createdAt: w.created_at,
						updatedAt: w.updated_at,
					})),
				);
			} catch (error) {
				log.api.error("Failed to list workflows:", error);
				return Response.json(
					{ error: error instanceof Error ? error.message : "Unknown error" },
					{ status: 500 },
				);
			}
		},
	},

	"/api/workflows/:id": {
		async GET(req: Request) {
			const params = parseParams(req, IdParamSchema);
			if (!params) {
				return Response.json({ error: "Invalid workflow ID" }, { status: 400 });
			}
			try {
				const orchestrator = getWorkflowOrchestrator();
				const workflow = await orchestrator.getWorkflow(params.id);

				if (!workflow) {
					return Response.json(
						{ error: "Workflow not found" },
						{ status: 404 },
					);
				}

				return Response.json(workflow);
			} catch (error) {
				log.api.error("Failed to get workflow:", error);
				return Response.json(
					{ error: error instanceof Error ? error.message : "Unknown error" },
					{ status: 500 },
				);
			}
		},
	},

	"/api/workflows/:id/approve": {
		async POST(req: Request) {
			const params = parseParams(req, IdParamSchema);
			if (!params) {
				return Response.json({ error: "Invalid workflow ID" }, { status: 400 });
			}
			try {
				const orchestrator = getWorkflowOrchestrator();
				await orchestrator.approveArtifact(params.id);
				return Response.json({ success: true });
			} catch (error) {
				log.api.error("Failed to approve artifact:", error);
				return Response.json(
					{ error: error instanceof Error ? error.message : "Unknown error" },
					{ status: 500 },
				);
			}
		},
	},

	"/api/workflows/:id/request-changes": {
		async POST(req: Request) {
			const params = parseParams(req, IdParamSchema);
			if (!params) {
				return Response.json({ error: "Invalid workflow ID" }, { status: 400 });
			}
			try {
				const body = await req.json();
				const parsed = RequestChangesRequestSchema.safeParse(body);

				if (!parsed.success) {
					return Response.json(
						{ error: "Invalid request", details: parsed.error.flatten() },
						{ status: 400 },
					);
				}

				const orchestrator = getWorkflowOrchestrator();
				await orchestrator.requestChanges(params.id, parsed.data.feedback);

				return Response.json({ success: true });
			} catch (error) {
				log.api.error("Failed to request changes:", error);
				return Response.json(
					{ error: error instanceof Error ? error.message : "Unknown error" },
					{ status: 500 },
				);
			}
		},
	},

	// =========================================================================
	// Channel Routes
	// =========================================================================

	"/api/channels": {
		async POST(req: Request) {
			try {
				const body = await req.json();
				const parsed = CreateChannelRequestSchema.safeParse(body);

				if (!parsed.success) {
					log.api.warn(
						"Invalid channel create request",
						parsed.error.flatten(),
					);
					return Response.json(
						{ error: "Invalid request", details: parsed.error.flatten() },
						{ status: 400 },
					);
				}

				const projectRoot = findRepoRoot(process.cwd());
				const db = await getProjectDb(projectRoot);

				// Check if channel with same name exists
				const existing = await db
					.selectFrom("channels")
					.select("id")
					.where("name", "=", parsed.data.name)
					.executeTakeFirst();

				if (existing) {
					log.api.warn(`Channel name already exists: ${parsed.data.name}`);
					return Response.json(
						{ error: "A channel with this name already exists" },
						{ status: 409 },
					);
				}

				const now = Date.now();
				const channelId = generateChannelId();

				await db
					.insertInto("channels")
					.values({
						id: channelId,
						name: parsed.data.name,
						description: parsed.data.description ?? null,
						created_at: now,
						updated_at: now,
					})
					.execute();

				const channel: Channel = {
					id: channelId,
					name: parsed.data.name,
					description: parsed.data.description,
					createdAt: now,
					updatedAt: now,
				};

				// Broadcast channel created event
				broadcast(
					createChannelCreatedEvent({
						channelId: channel.id,
						name: channel.name,
						description: channel.description,
					}),
				);

				log.api.success(`Created channel #${channel.name} (${channelId})`);
				return Response.json(channel, { status: 201 });
			} catch (error) {
				log.api.error("Failed to create channel:", error);
				return Response.json(
					{ error: error instanceof Error ? error.message : "Unknown error" },
					{ status: 500 },
				);
			}
		},

		async GET(_req: Request) {
			try {
				const projectRoot = findRepoRoot(process.cwd());
				const db = await getProjectDb(projectRoot);

				const channels = await db
					.selectFrom("channels")
					.selectAll()
					.orderBy("name", "asc")
					.execute();

				return Response.json(
					channels.map(
						(c): Channel => ({
							id: c.id,
							name: c.name,
							description: c.description ?? undefined,
							createdAt: c.created_at,
							updatedAt: c.updated_at,
						}),
					),
				);
			} catch (error) {
				log.api.error("Failed to list channels:", error);
				return Response.json(
					{ error: error instanceof Error ? error.message : "Unknown error" },
					{ status: 500 },
				);
			}
		},
	},

	"/api/channels/:id": {
		async GET(req: Request) {
			const params = parseParams(req, IdParamSchema);
			if (!params) {
				return Response.json({ error: "Invalid channel ID" }, { status: 400 });
			}
			try {
				const projectRoot = findRepoRoot(process.cwd());
				const db = await getProjectDb(projectRoot);

				const channel = await db
					.selectFrom("channels")
					.selectAll()
					.where("id", "=", params.id)
					.executeTakeFirst();

				if (!channel) {
					return Response.json({ error: "Channel not found" }, { status: 404 });
				}

				return Response.json({
					id: channel.id,
					name: channel.name,
					description: channel.description ?? undefined,
					createdAt: channel.created_at,
					updatedAt: channel.updated_at,
				} satisfies Channel);
			} catch (error) {
				log.api.error("Failed to get channel:", error);
				return Response.json(
					{ error: error instanceof Error ? error.message : "Unknown error" },
					{ status: 500 },
				);
			}
		},

		async DELETE(req: Request) {
			const params = parseParams(req, IdParamSchema);
			if (!params) {
				return Response.json({ error: "Invalid channel ID" }, { status: 400 });
			}
			try {
				const projectRoot = findRepoRoot(process.cwd());
				const db = await getProjectDb(projectRoot);

				// Check if channel exists
				const channel = await db
					.selectFrom("channels")
					.select("id")
					.where("id", "=", params.id)
					.executeTakeFirst();

				if (!channel) {
					return Response.json({ error: "Channel not found" }, { status: 404 });
				}

				// Delete the channel
				await db.deleteFrom("channels").where("id", "=", params.id).execute();

				// Broadcast channel deleted event
				broadcast(createChannelDeletedEvent({ channelId: params.id }));

				return Response.json({ success: true });
			} catch (error) {
				log.api.error("Failed to delete channel:", error);
				return Response.json(
					{ error: error instanceof Error ? error.message : "Unknown error" },
					{ status: 500 },
				);
			}
		},
	},

	"/api/channels/:id/session": {
		async POST(req: Request) {
			const params = parseParams(req, IdParamSchema);
			if (!params) {
				return Response.json({ error: "Invalid channel ID" }, { status: 400 });
			}
			const channelId = params.id;
			try {
				const sessionManager = getSessionManager();

				// Check if already has active session
				const existing = sessionManager.getSessionByContext(
					"channel",
					channelId,
				);
				if (existing?.status === "active") {
					log.api.debug(
						`Reusing existing session ${existing.id} for channel ${channelId}`,
					);
					return Response.json({
						sessionId: existing.id,
						alreadyActive: true,
					});
				}

				const session = await sessionManager.startSession({
					contextType: "channel",
					contextId: channelId,
					agentRole: "discussion",
				});

				log.api.info(`Started session ${session.id} for channel ${channelId}`);
				return Response.json({ sessionId: session.id }, { status: 201 });
			} catch (error) {
				log.api.error(
					`Failed to start channel session for ${channelId}:`,
					error,
				);
				return Response.json(
					{ error: error instanceof Error ? error.message : "Unknown error" },
					{ status: 500 },
				);
			}
		},
	},

	"/api/channels/:id/history": {
		async GET(req: Request) {
			const params = parseParams(req, IdParamSchema);
			if (!params) {
				return Response.json({ error: "Invalid channel ID" }, { status: 400 });
			}
			const channelId = params.id;
			try {
				const projectRoot = findRepoRoot(process.cwd());
				const db = await getProjectDb(projectRoot);

				// Get the channel
				const channel = await db
					.selectFrom("channels")
					.selectAll()
					.where("id", "=", channelId)
					.executeTakeFirst();

				if (!channel) {
					return Response.json({ error: "Channel not found" }, { status: 404 });
				}

				// Get all sessions for this channel
				const sessions = await db
					.selectFrom("sessions")
					.selectAll()
					.where("context_type", "=", "channel")
					.where("context_id", "=", channelId)
					.orderBy("created_at", "asc")
					.execute();

				// Find the most recent active session
				const activeSession = sessions.find((s) => s.status === "active");

				// Build messages from all sessions
				const messages: ChannelMessage[] = [];

				for (const session of sessions) {
					// Get turns for this session
					const turns = await db
						.selectFrom("turns")
						.selectAll()
						.where("session_id", "=", session.id)
						.orderBy("turn_index", "asc")
						.execute();

					for (const turn of turns) {
						// Get messages for this turn
						const turnMessages = await db
							.selectFrom("turn_messages")
							.selectAll()
							.where("turn_id", "=", turn.id)
							.orderBy("message_index", "asc")
							.execute();

						// Get tool calls for this turn
						const toolCalls = await db
							.selectFrom("turn_tools")
							.selectAll()
							.where("turn_id", "=", turn.id)
							.orderBy("tool_index", "asc")
							.execute();

						// Get thoughts for this turn
						const thoughts = await db
							.selectFrom("turn_thoughts")
							.selectAll()
							.where("turn_id", "=", turn.id)
							.orderBy("thought_index", "asc")
							.execute();

						// Get questions for this turn
						const questions = await db
							.selectFrom("questions")
							.selectAll()
							.where("turn_id", "=", turn.id)
							.orderBy("question_index", "asc")
							.execute();

						// Build segments array from turn messages (ordered by message_index)
						const segments = turnMessages.map((m) => ({
							index: m.message_index,
							content: m.content,
						}));

						// Only include turns that have content, tools, or questions
						const hasContent = segments.some((s) => s.content.length > 0);
						if (hasContent || toolCalls.length > 0 || questions.length > 0) {
							const message: ChannelMessage = {
								id: turn.id,
								turnId: turn.id,
								role: turn.role as "user" | "assistant",
								segments,
								timestamp: turn.created_at,
								toolCalls:
									toolCalls.length > 0
										? toolCalls.map((tc) => ({
												id: tc.id,
												name: tc.tool_name,
												input: JSON.parse(tc.input_json),
												output: tc.output_json
													? JSON.parse(tc.output_json)
													: undefined,
												status: tc.status as "running" | "completed" | "error",
											}))
										: undefined,
								thought:
									thoughts.length > 0
										? thoughts.map((t) => t.content).join("\n")
										: undefined,
								questions:
									questions.length > 0
										? questions.map((q) => ({
												id: q.id,
												questionIndex: q.question_index,
												type: q.type as
													| "single_select"
													| "multi_select"
													| "ranked"
													| "free_text",
												prompt: q.prompt,
												options: q.options_json
													? JSON.parse(q.options_json)
													: undefined,
												answer: q.answer_json
													? JSON.parse(q.answer_json)
													: undefined,
												status: q.status as "pending" | "answered",
											}))
										: undefined,
							};

							messages.push(message);
						}
					}
				}

				const response: ChannelHistoryResponse = {
					channel: {
						id: channel.id,
						name: channel.name,
						description: channel.description ?? undefined,
						createdAt: channel.created_at,
						updatedAt: channel.updated_at,
					},
					sessionId: activeSession?.id,
					sessionStatus: activeSession?.status as
						| "active"
						| "completed"
						| "error"
						| undefined,
					messages,
				};

				return Response.json(response);
			} catch (error) {
				log.api.error("Failed to get channel history:", error);
				return Response.json(
					{ error: error instanceof Error ? error.message : "Unknown error" },
					{ status: 500 },
				);
			}
		},
	},

	// =========================================================================
	// Session Routes
	// =========================================================================

	"/api/sessions/:id/message": {
		async POST(req: Request) {
			const params = parseParams(req, IdParamSchema);
			if (!params) {
				return Response.json({ error: "Invalid session ID" }, { status: 400 });
			}
			const sessionId = params.id;
			try {
				const body = await req.json();
				const parsed = SendMessageRequestSchema.safeParse(body);

				if (!parsed.success) {
					log.api.warn("Invalid message request", parsed.error.flatten());
					return Response.json(
						{ error: "Invalid request", details: parsed.error.flatten() },
						{ status: 400 },
					);
				}

				const sessionManager = getSessionManager();
				const session = await sessionManager.getOrRestoreSession(sessionId);

				if (!session) {
					log.api.warn(`Session not found: ${sessionId}`);
					return Response.json({ error: "Session not found" }, { status: 404 });
				}

				if (session.status !== "active") {
					log.api.warn(`Session not active: ${sessionId} (${session.status})`);
					return Response.json(
						{ error: "Session is not active" },
						{ status: 400 },
					);
				}

				const projectRoot = findRepoRoot(process.cwd());
				const db = await getProjectDb(projectRoot);

				const runner = new AgentRunner(session, { projectRoot, db });

				log.api.info(`Message received for session ${sessionId}`);

				// Run in background (non-blocking)
				runner.run(parsed.data.content).catch((error) => {
					log.agent.error(`Agent run failed for session ${sessionId}:`, error);
					sessionManager.errorSession(
						sessionId,
						error instanceof Error ? error.message : "Unknown error",
					);
				});

				return Response.json({ success: true, sessionId });
			} catch (error) {
				log.api.error("Failed to send message:", error);
				return Response.json(
					{ error: error instanceof Error ? error.message : "Unknown error" },
					{ status: 500 },
				);
			}
		},
	},

	// =========================================================================
	// Question Routes
	// =========================================================================

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
						{ error: "Invalid request", details: parsed.error.flatten() },
						{ status: 400 },
					);
				}

				const projectRoot = findRepoRoot(process.cwd());
				const db = await getProjectDb(projectRoot);

				// Get the question
				const question = await db
					.selectFrom("questions")
					.selectAll()
					.where("id", "=", questionId)
					.executeTakeFirst();

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

				const now = Date.now();

				// Update the question with the answer
				await db
					.updateTable("questions")
					.set({
						answer_json: JSON.stringify(parsed.data.answer),
						status: "answered",
						answered_at: now,
					})
					.where("id", "=", questionId)
					.execute();

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
				const pendingQuestions = await db
					.selectFrom("questions")
					.select(["id"])
					.where("turn_id", "=", question.turn_id)
					.where("status", "=", "pending")
					.execute();

				const allAnswered = pendingQuestions.length === 0;

				// If all questions are answered, auto-resume the agent
				if (allAnswered) {
					// Get all questions for this turn to format the answer message
					const allQuestions = await db
						.selectFrom("questions")
						.selectAll()
						.where("turn_id", "=", question.turn_id)
						.orderBy("question_index", "asc")
						.execute();

					// Format answers as a user message
					const answerLines = allQuestions.map((q) => {
						const answer = q.answer_json ? JSON.parse(q.answer_json) : null;
						const formattedAnswer = Array.isArray(answer)
							? answer.join(", ")
							: String(answer);
						return `**${q.prompt}**: ${formattedAnswer}`;
					});
					const answerMessage = answerLines.join("\n\n");

					// Get session and send the answer message
					const sessionManager = getSessionManager();
					const session = await sessionManager.getOrRestoreSession(
						question.session_id,
					);

					if (session && session.status === "active") {
						const runner = new AgentRunner(session, { projectRoot, db });

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
						{ error: "Invalid request", details: parsed.error.flatten() },
						{ status: 400 },
					);
				}

				const projectRoot = findRepoRoot(process.cwd());
				const db = await getProjectDb(projectRoot);
				const now = Date.now();

				let sessionId: string | null = null;
				let turnId: string | null = null;
				let answeredCount = 0;

				// Process each answer
				for (const { questionId, answer } of parsed.data.answers) {
					const question = await db
						.selectFrom("questions")
						.selectAll()
						.where("id", "=", questionId)
						.executeTakeFirst();

					if (!question || question.status === "answered") {
						continue;
					}

					// Track session/turn for later
					sessionId = question.session_id;
					turnId = question.turn_id;

					// Update the question
					await db
						.updateTable("questions")
						.set({
							answer_json: JSON.stringify(answer),
							status: "answered",
							answered_at: now,
						})
						.where("id", "=", questionId)
						.execute();

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

				if (!sessionId || !turnId) {
					return Response.json(
						{ error: "No valid questions to answer" },
						{ status: 400 },
					);
				}

				// Check if all questions for this turn are answered
				const pendingQuestions = await db
					.selectFrom("questions")
					.select(["id"])
					.where("turn_id", "=", turnId)
					.where("status", "=", "pending")
					.execute();

				const allAnswered = pendingQuestions.length === 0;

				// If all questions are answered, auto-resume the agent
				if (allAnswered) {
					// Get all questions for this turn to format the answer message
					const allQuestions = await db
						.selectFrom("questions")
						.selectAll()
						.where("turn_id", "=", turnId)
						.orderBy("question_index", "asc")
						.execute();

					// Format answers as a user message
					const answerLines = allQuestions.map((q) => {
						const answer = q.answer_json ? JSON.parse(q.answer_json) : null;
						const formattedAnswer = Array.isArray(answer)
							? answer.join(", ")
							: String(answer);
						return `**${q.prompt}**: ${formattedAnswer}`;
					});
					const answerMessage = answerLines.join("\n\n");

					// Get session and send the answer message
					const sessionManager = getSessionManager();
					const session = await sessionManager.getOrRestoreSession(sessionId);

					if (session && session.status === "active") {
						const runner = new AgentRunner(session, { projectRoot, db });

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
