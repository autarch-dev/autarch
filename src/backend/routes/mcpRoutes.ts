/**
 * MCP Routes
 *
 * HTTP endpoints for the Autarch MCP server.
 * Claude Code connects to these via `--mcp-config` with HTTP transport.
 *
 * Each session gets its own MCP endpoint at `/mcp/sessions/:sessionId`.
 * Stateless mode: a new WebStandardStreamableHTTPServerTransport is created
 * per request and connected to the session's McpServer.
 */

import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { log } from "@/backend/logger";
import { createMcpServerForRequest } from "@/backend/mcp/McpServer";

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
 * Handle an MCP request by creating a fresh stateless transport per request,
 * connecting it to the session's McpServer, and delegating.
 */
async function handleMcpRequest(
	sessionId: string,
	req: Request,
): Promise<Response> {
	const transport = new WebStandardStreamableHTTPServerTransport({
		sessionIdGenerator: undefined,
		enableJsonResponse: true,
	});

	const server = await createMcpServerForRequest(sessionId);
	await server.connect(transport);

	return await transport.handleRequest(req);
}

export const mcpRoutes = {
	"/mcp/sessions/:sessionId": {
		async POST(req: Request) {
			try {
				const params = parseParams(req, McpSessionParams);
				return await handleMcpRequest(params.sessionId, req);
			} catch (error) {
				log.agent.error("MCP POST handler error:", error);
				return Response.json({ error: "MCP request failed" }, { status: 500 });
			}
		},

		async GET(req: Request) {
			try {
				const params = parseParams(req, McpSessionParams);
				return await handleMcpRequest(params.sessionId, req);
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
				return await handleMcpRequest(params.sessionId, req);
			} catch (error) {
				log.agent.error("MCP DELETE handler error:", error);
				return Response.json({ error: "MCP cleanup failed" }, { status: 500 });
			}
		},
	},
};

/**
 * Clean up MCP transport for a session. No-op in stateless mode since
 * transports are created per-request, but kept for interface compatibility.
 */
export async function cleanupMcpTransport(_sessionId: string): Promise<void> {
	// Stateless mode: nothing to clean up
}
