/**
 * MCP Routes
 *
 * HTTP endpoints for the Autarch MCP server.
 * Claude Code connects to these via `--mcp-config` with HTTP transport.
 *
 * Each session gets its own MCP endpoint at `/mcp/sessions/:sessionId`.
 * The WebStandardStreamableHTTPServerTransport handles the MCP protocol
 * over standard HTTP Request/Response objects.
 */

import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { log } from "@/backend/logger";
import { getOrCreateMcpServer } from "@/backend/mcp/McpServer";

const McpSessionParams = z.object({
	sessionId: z.string(),
});

function parseParams<T extends z.ZodTypeAny>(
	// biome-ignore lint/suspicious/noExplicitAny: Bun adds params to Request
	req: Request & { params?: any },
	schema: T,
): z.infer<T> {
	return schema.parse(req.params);
}

/**
 * Per-session transports. Each session gets a persistent transport
 * that the McpServer is connected to.
 */
const transports = new Map<string, WebStandardStreamableHTTPServerTransport>();

async function getOrCreateTransport(
	sessionId: string,
): Promise<WebStandardStreamableHTTPServerTransport> {
	const existing = transports.get(sessionId);
	if (existing) {
		return existing;
	}

	const transport = new WebStandardStreamableHTTPServerTransport({
		// Stateless mode — session management is handled by Autarch, not MCP SDK
		sessionIdGenerator: undefined,
		enableJsonResponse: true,
	});

	const server = getOrCreateMcpServer(sessionId);
	await server.connect(transport);

	transports.set(sessionId, transport);
	log.agent.info(`MCP transport created for session ${sessionId}`);

	return transport;
}

/**
 * Clean up transport for a session. Called when session ends.
 */
export async function cleanupMcpTransport(sessionId: string): Promise<void> {
	const transport = transports.get(sessionId);
	if (transport) {
		await transport.close();
		transports.delete(sessionId);
	}
}

export const mcpRoutes = {
	"/mcp/sessions/:sessionId": {
		async POST(req: Request) {
			try {
				const params = parseParams(req, McpSessionParams);
				const transport = await getOrCreateTransport(params.sessionId);
				return await transport.handleRequest(req);
			} catch (error) {
				log.agent.error("MCP POST handler error:", error);
				return Response.json({ error: "MCP request failed" }, { status: 500 });
			}
		},

		async GET(req: Request) {
			try {
				const params = parseParams(req, McpSessionParams);
				const transport = await getOrCreateTransport(params.sessionId);
				return await transport.handleRequest(req);
			} catch (error) {
				log.agent.error("MCP GET handler error:", error);
				return Response.json(
					{ error: "MCP SSE connection failed" },
					{ status: 500 },
				);
			}
		},

		async DELETE(req: Request) {
			try {
				const params = parseParams(req, McpSessionParams);
				const transport = transports.get(params.sessionId);
				if (transport) {
					const response = await transport.handleRequest(req);
					await cleanupMcpTransport(params.sessionId);
					return response;
				}
				return new Response(null, { status: 204 });
			} catch (error) {
				log.agent.error("MCP DELETE handler error:", error);
				return Response.json({ error: "MCP cleanup failed" }, { status: 500 });
			}
		},
	},
};
