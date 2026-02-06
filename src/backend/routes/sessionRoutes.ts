/**
 * Session API Routes
 *
 * Routes for sending messages to active sessions.
 */

import { z } from "zod";
import { AgentRunner, getSessionManager } from "../agents/runner";
import { log } from "../logger";
import { getProjectRoot } from "../projectRoot";
import { getRepositories } from "../repositories";

// =============================================================================
// Schemas
// =============================================================================

const IdParamSchema = z.object({
	id: z.string().min(1),
});

const SendMessageRequestSchema = z.object({
	content: z.string().min(1),
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

export const sessionRoutes = {
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
					return Response.json(
						{
							error: "Invalid request body",
							details: z.prettifyError(parsed.error),
						},
						{ status: 400 },
					);
				}

				// Get the session (restore from DB if needed)
				const sessionManager = getSessionManager();
				const session = await sessionManager.getOrRestoreSession(sessionId);

				if (!session) {
					return Response.json(
						{ error: "Session not found or not active" },
						{ status: 404 },
					);
				}

				if (session.status !== "active") {
					return Response.json(
						{ error: `Session is ${session.status}, not active` },
						{ status: 400 },
					);
				}

				const projectRoot = getProjectRoot();
				const repos = getRepositories();

				const runner = new AgentRunner(session, {
					projectRoot,
					conversationRepo: repos.conversations,
				});

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
