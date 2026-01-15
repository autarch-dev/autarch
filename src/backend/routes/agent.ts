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
} from "@/shared/schemas/events";
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
					return Response.json({ error: "Workflow not found" }, { status: 404 });
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
					log.api.warn("Invalid channel create request", parsed.error.flatten());
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
				const existing = sessionManager.getSessionByContext("channel", channelId);
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

						// Combine message content
						const content = turnMessages.map((m) => m.content).join("\n");

						if (content || toolCalls.length > 0) {
							const message: ChannelMessage = {
								id: turn.id,
								turnId: turn.id,
								role: turn.role as "user" | "assistant",
								content,
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
};
