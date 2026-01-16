/**
 * Channel API Routes
 *
 * Routes for managing discussion channels.
 * Uses repositories for data access.
 */

import { z } from "zod";
import { CreateChannelRequestSchema } from "@/shared/schemas/channel";
import {
	createChannelCreatedEvent,
	createChannelDeletedEvent,
} from "@/shared/schemas/events";
import { getSessionManager } from "../agents/runner";
import { log } from "../logger";
import { getRepositories } from "../repositories";
import { broadcast } from "../ws";

// =============================================================================
// Schemas
// =============================================================================

const IdParamSchema = z.object({
	id: z.string().min(1),
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

export const channelRoutes = {
	"/api/channels": {
		async GET() {
			try {
				const repos = getRepositories();
				const channels = await repos.channels.list();
				return Response.json(channels);
			} catch (error) {
				log.api.error("Failed to list channels:", error);
				return Response.json(
					{ error: error instanceof Error ? error.message : "Unknown error" },
					{ status: 500 },
				);
			}
		},

		async POST(req: Request) {
			try {
				const body = await req.json();
				const parsed = CreateChannelRequestSchema.safeParse(body);
				if (!parsed.success) {
					return Response.json(
						{ error: "Invalid request body", details: z.prettifyError(parsed.error) },
						{ status: 400 },
					);
				}

				const repos = getRepositories();

				// Check if channel name already exists
				if (await repos.channels.nameExists(parsed.data.name)) {
					return Response.json(
						{ error: "Channel name already exists" },
						{ status: 409 },
					);
				}

				const channel = await repos.channels.create(
					parsed.data.name,
					parsed.data.description,
				);

				// Broadcast channel created event
				broadcast(
					createChannelCreatedEvent({
						channelId: channel.id,
						name: channel.name,
					}),
				);

				log.api.success(`Created channel: ${channel.name}`);
				return Response.json(channel, { status: 201 });
			} catch (error) {
				log.api.error("Failed to create channel:", error);
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
				const repos = getRepositories();
				const channel = await repos.channels.getById(params.id);
				if (!channel) {
					return Response.json({ error: "Channel not found" }, { status: 404 });
				}
				return Response.json(channel);
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
				const repos = getRepositories();

				// Check if channel exists
				const channel = await repos.channels.getById(params.id);
				if (!channel) {
					return Response.json({ error: "Channel not found" }, { status: 404 });
				}

				// Stop any active session for this channel
				const sessionManager = getSessionManager();
				const activeSession = sessionManager.getSessionByContext(
					"channel",
					params.id,
				);
				if (activeSession) {
					await sessionManager.stopSession(activeSession.id);
				}

				// Delete the channel
				await repos.channels.delete(params.id);

				// Broadcast deletion event
				broadcast(createChannelDeletedEvent({ channelId: params.id }));

				log.api.success(`Deleted channel: ${params.id}`);
				return new Response(null, { status: 204 });
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
				const repos = getRepositories();

				// Verify channel exists
				const channel = await repos.channels.getById(channelId);
				if (!channel) {
					return Response.json({ error: "Channel not found" }, { status: 404 });
				}

				// Start new session for this channel
				const sessionManager = getSessionManager();
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
				const repos = getRepositories();

				// Get the channel
				const channel = await repos.channels.getById(channelId);
				if (!channel) {
					return Response.json({ error: "Channel not found" }, { status: 404 });
				}

				// Get conversation history using repository
				const { messages, activeSessionId, activeSessionStatus } =
					await repos.conversations.getHistory("channel", channelId);

				const response = {
					channel,
					sessionId: activeSessionId,
					sessionStatus: activeSessionStatus,
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
};
