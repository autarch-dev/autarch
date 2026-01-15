/**
 * Agent API Routes
 *
 * Routes for managing workflows, channels, sessions, and agent interactions.
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

// =============================================================================
// Route Handlers
// =============================================================================

/**
 * POST /api/workflows - Create a new workflow
 */
async function createWorkflow(req: Request): Promise<Response> {
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
		console.error("Failed to create workflow:", error);
		return Response.json(
			{ error: error instanceof Error ? error.message : "Unknown error" },
			{ status: 500 },
		);
	}
}

/**
 * GET /api/workflows - List all workflows
 */
async function listWorkflows(_req: Request): Promise<Response> {
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
		console.error("Failed to list workflows:", error);
		return Response.json(
			{ error: error instanceof Error ? error.message : "Unknown error" },
			{ status: 500 },
		);
	}
}

/**
 * GET /api/workflows/:id - Get a workflow by ID
 */
async function getWorkflow(
	_req: Request,
	workflowId: string,
): Promise<Response> {
	try {
		const orchestrator = getWorkflowOrchestrator();
		const workflow = await orchestrator.getWorkflow(workflowId);

		if (!workflow) {
			return Response.json({ error: "Workflow not found" }, { status: 404 });
		}

		return Response.json(workflow);
	} catch (error) {
		console.error("Failed to get workflow:", error);
		return Response.json(
			{ error: error instanceof Error ? error.message : "Unknown error" },
			{ status: 500 },
		);
	}
}

/**
 * POST /api/workflows/:id/approve - Approve pending artifact
 */
async function approveArtifact(
	_req: Request,
	workflowId: string,
): Promise<Response> {
	try {
		const orchestrator = getWorkflowOrchestrator();
		await orchestrator.approveArtifact(workflowId);

		return Response.json({ success: true });
	} catch (error) {
		console.error("Failed to approve artifact:", error);
		return Response.json(
			{ error: error instanceof Error ? error.message : "Unknown error" },
			{ status: 500 },
		);
	}
}

/**
 * POST /api/workflows/:id/request-changes - Request changes to pending artifact
 */
async function requestChanges(
	req: Request,
	workflowId: string,
): Promise<Response> {
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
		await orchestrator.requestChanges(workflowId, parsed.data.feedback);

		return Response.json({ success: true });
	} catch (error) {
		console.error("Failed to request changes:", error);
		return Response.json(
			{ error: error instanceof Error ? error.message : "Unknown error" },
			{ status: 500 },
		);
	}
}

/**
 * POST /api/sessions/:id/message - Send a message to a session
 */
async function sendMessage(req: Request, sessionId: string): Promise<Response> {
	try {
		const body = await req.json();
		const parsed = SendMessageRequestSchema.safeParse(body);

		if (!parsed.success) {
			return Response.json(
				{ error: "Invalid request", details: parsed.error.flatten() },
				{ status: 400 },
			);
		}

		const sessionManager = getSessionManager();
		const session = sessionManager.getSession(sessionId);

		if (!session) {
			return Response.json({ error: "Session not found" }, { status: 404 });
		}

		if (session.status !== "active") {
			return Response.json({ error: "Session is not active" }, { status: 400 });
		}

		const projectRoot = findRepoRoot(process.cwd());
		const db = await getProjectDb(projectRoot);

		const runner = new AgentRunner(session, { projectRoot, db });

		// Run in background (non-blocking)
		runner.run(parsed.data.content).catch((error) => {
			console.error("Agent run failed:", error);
			sessionManager.errorSession(
				sessionId,
				error instanceof Error ? error.message : "Unknown error",
			);
		});

		return Response.json({ success: true, sessionId });
	} catch (error) {
		console.error("Failed to send message:", error);
		return Response.json(
			{ error: error instanceof Error ? error.message : "Unknown error" },
			{ status: 500 },
		);
	}
}

/**
 * POST /api/channels/:id/session - Start a channel session
 */
async function startChannelSession(
	_req: Request,
	channelId: string,
): Promise<Response> {
	try {
		const sessionManager = getSessionManager();

		// Check if already has active session
		const existing = sessionManager.getSessionByContext("channel", channelId);
		if (existing?.status === "active") {
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

		return Response.json({ sessionId: session.id }, { status: 201 });
	} catch (error) {
		console.error("Failed to start channel session:", error);
		return Response.json(
			{ error: error instanceof Error ? error.message : "Unknown error" },
			{ status: 500 },
		);
	}
}

// =============================================================================
// Channel CRUD Routes
// =============================================================================

/**
 * POST /api/channels - Create a new channel
 */
async function createChannel(req: Request): Promise<Response> {
	try {
		const body = await req.json();
		const parsed = CreateChannelRequestSchema.safeParse(body);

		if (!parsed.success) {
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

		return Response.json(channel, { status: 201 });
	} catch (error) {
		console.error("Failed to create channel:", error);
		return Response.json(
			{ error: error instanceof Error ? error.message : "Unknown error" },
			{ status: 500 },
		);
	}
}

/**
 * GET /api/channels - List all channels
 */
async function listChannels(_req: Request): Promise<Response> {
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
		console.error("Failed to list channels:", error);
		return Response.json(
			{ error: error instanceof Error ? error.message : "Unknown error" },
			{ status: 500 },
		);
	}
}

/**
 * GET /api/channels/:id - Get a channel by ID
 */
async function getChannel(_req: Request, channelId: string): Promise<Response> {
	try {
		const projectRoot = findRepoRoot(process.cwd());
		const db = await getProjectDb(projectRoot);

		const channel = await db
			.selectFrom("channels")
			.selectAll()
			.where("id", "=", channelId)
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
		console.error("Failed to get channel:", error);
		return Response.json(
			{ error: error instanceof Error ? error.message : "Unknown error" },
			{ status: 500 },
		);
	}
}

/**
 * DELETE /api/channels/:id - Delete a channel
 */
async function deleteChannel(
	_req: Request,
	channelId: string,
): Promise<Response> {
	try {
		const projectRoot = findRepoRoot(process.cwd());
		const db = await getProjectDb(projectRoot);

		// Check if channel exists
		const channel = await db
			.selectFrom("channels")
			.select("id")
			.where("id", "=", channelId)
			.executeTakeFirst();

		if (!channel) {
			return Response.json({ error: "Channel not found" }, { status: 404 });
		}

		// Delete the channel
		await db.deleteFrom("channels").where("id", "=", channelId).execute();

		// Broadcast channel deleted event
		broadcast(createChannelDeletedEvent({ channelId }));

		return Response.json({ success: true });
	} catch (error) {
		console.error("Failed to delete channel:", error);
		return Response.json(
			{ error: error instanceof Error ? error.message : "Unknown error" },
			{ status: 500 },
		);
	}
}

/**
 * GET /api/channels/:id/history - Get channel conversation history
 *
 * Used for page reload hydration - returns the channel and all messages.
 */
async function getChannelHistory(
	_req: Request,
	channelId: string,
): Promise<Response> {
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
		console.error("Failed to get channel history:", error);
		return Response.json(
			{ error: error instanceof Error ? error.message : "Unknown error" },
			{ status: 500 },
		);
	}
}

// =============================================================================
// Helpers
// =============================================================================

function generateChannelId(): string {
	return `ch_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// =============================================================================
// Route Definitions
// =============================================================================

export const agentRoutes = {
	// Workflow routes
	"POST /api/workflows": createWorkflow,
	"GET /api/workflows": listWorkflows,

	// Channel routes (static paths)
	"POST /api/channels": createChannel,
	"GET /api/channels": listChannels,

	// These need dynamic routing - handled via pattern matching
	// Workflow: "GET /api/workflows/:id", "POST /api/workflows/:id/approve", etc.
	// Session: "POST /api/sessions/:id/message"
	// Channel: "GET /api/channels/:id", "DELETE /api/channels/:id", etc.
} as const;

/**
 * Handle dynamic routes with path parameters
 */
export async function handleAgentRoute(
	req: Request,
	path: string,
): Promise<Response | null> {
	const method = req.method;

	// Workflow by ID: GET /api/workflows/:id
	const workflowMatch = path.match(/^\/api\/workflows\/([^/]+)$/);
	if (workflowMatch?.[1] && method === "GET") {
		return getWorkflow(req, workflowMatch[1]);
	}

	// Approve artifact: POST /api/workflows/:id/approve
	const approveMatch = path.match(/^\/api\/workflows\/([^/]+)\/approve$/);
	if (approveMatch?.[1] && method === "POST") {
		return approveArtifact(req, approveMatch[1]);
	}

	// Request changes: POST /api/workflows/:id/request-changes
	const changesMatch = path.match(
		/^\/api\/workflows\/([^/]+)\/request-changes$/,
	);
	if (changesMatch?.[1] && method === "POST") {
		return requestChanges(req, changesMatch[1]);
	}

	// Send message: POST /api/sessions/:id/message
	const messageMatch = path.match(/^\/api\/sessions\/([^/]+)\/message$/);
	if (messageMatch?.[1] && method === "POST") {
		return sendMessage(req, messageMatch[1]);
	}

	// Start channel session: POST /api/channels/:id/session
	const channelSessionMatch = path.match(/^\/api\/channels\/([^/]+)\/session$/);
	if (channelSessionMatch?.[1] && method === "POST") {
		return startChannelSession(req, channelSessionMatch[1]);
	}

	// Get channel history: GET /api/channels/:id/history
	const channelHistoryMatch = path.match(/^\/api\/channels\/([^/]+)\/history$/);
	if (channelHistoryMatch?.[1] && method === "GET") {
		return getChannelHistory(req, channelHistoryMatch[1]);
	}

	// Get channel by ID: GET /api/channels/:id
	const channelGetMatch = path.match(/^\/api\/channels\/([^/]+)$/);
	if (channelGetMatch?.[1] && method === "GET") {
		return getChannel(req, channelGetMatch[1]);
	}

	// Delete channel: DELETE /api/channels/:id
	const channelDeleteMatch = path.match(/^\/api\/channels\/([^/]+)$/);
	if (channelDeleteMatch?.[1] && method === "DELETE") {
		return deleteChannel(req, channelDeleteMatch[1]);
	}

	return null;
}
