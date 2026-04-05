/**
 * Autarch MCP Server
 *
 * Exposes Autarch's unique tools via the Model Context Protocol.
 * Creates per-session MCP server instances that Claude Code connects to
 * via HTTP transport on Autarch's existing Bun server.
 *
 * Tool execution flow:
 *   Claude Code → HTTP POST /mcp/sessions/:sessionId
 *     → MCP SDK dispatches to tool handler
 *     → Handler looks up session → constructs ToolContext → executes RegisteredTool
 *     → Checks for terminal tool → signals runner termination if needed
 *     → Returns result to Claude Code
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TERMINAL_TOOLS } from "@/backend/agents/runner/BaseAgentRunner";
import { getSessionManager } from "@/backend/agents/runner/SessionManager";
import type { ActiveSession } from "@/backend/agents/runner/types";
import { getProjectDb } from "@/backend/db/project";
import {
	createChannelToolContext,
	createRoadmapToolContext,
	createWorkflowToolContext,
} from "@/backend/llm";
import { log } from "@/backend/logger";
import { toolRegistry } from "@/backend/tools";
import type { ToolContext, ToolResult } from "@/backend/tools/types";
import { signalTermination } from "./runnerRegistry";
import { isMcpTool } from "./toolClassification";

// =============================================================================
// Session-scoped MCP server instances
// =============================================================================

const mcpServers = new Map<string, McpServer>();

/**
 * Get or create an MCP server instance for a session.
 *
 * Each session gets its own McpServer with tools registered based on
 * the session's agent role. The server is stateless per-request via
 * WebStandardStreamableHTTPServerTransport.
 */
export function getOrCreateMcpServer(sessionId: string): McpServer {
	const existing = mcpServers.get(sessionId);
	if (existing) {
		return existing;
	}

	const server = createMcpServer(sessionId);
	mcpServers.set(sessionId, server);
	return server;
}

/**
 * Clean up an MCP server when a session ends.
 */
export async function cleanupMcpServer(sessionId: string): Promise<void> {
	const server = mcpServers.get(sessionId);
	if (server) {
		await server.close();
		mcpServers.delete(sessionId);
	}
}

// =============================================================================
// MCP Server Creation
// =============================================================================

function createMcpServer(sessionId: string): McpServer {
	const server = new McpServer(
		{
			name: "autarch",
			version: "1.0.0",
		},
		{
			capabilities: {
				tools: {},
			},
		},
	);

	// Register all MCP-classified tools
	for (const [toolName, registeredTool] of Object.entries(toolRegistry)) {
		if (!isMcpTool(toolName)) {
			continue;
		}

		server.registerTool(
			toolName,
			{
				description: registeredTool.description,
				inputSchema: registeredTool.inputSchema,
			},
			async (input) => {
				return await executeTool(sessionId, toolName, input, registeredTool);
			},
		);
	}

	return server;
}

// =============================================================================
// Tool Execution
// =============================================================================

async function executeTool(
	sessionId: string,
	toolName: string,
	input: unknown,
	registeredTool: {
		execute: (input: unknown, context: ToolContext) => Promise<ToolResult>;
	},
): Promise<{
	content: Array<{ type: "text"; text: string }>;
	isError?: boolean;
}> {
	const sessionManager = getSessionManager();
	const session = await sessionManager.getOrRestoreSession(sessionId);

	if (!session) {
		return {
			content: [{ type: "text", text: `Session not found: ${sessionId}` }],
			isError: true,
		};
	}

	// Construct ToolContext for this session
	const toolResultMap = new Map<string, boolean>();
	const toolContext = await buildToolContext(session, toolResultMap);

	try {
		const result = await registeredTool.execute(input, toolContext);

		// Check if this is a terminal tool that should end the session
		checkTerminalTool(sessionId, session, toolName, result.success);

		return {
			content: [{ type: "text", text: result.output }],
			isError: !result.success,
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		log.agent.error(
			`MCP tool ${toolName} failed for session ${sessionId}:`,
			error,
		);
		return {
			content: [{ type: "text", text: `Tool execution failed: ${message}` }],
			isError: true,
		};
	}
}

// =============================================================================
// Tool Context Construction
// =============================================================================

/**
 * Build a ToolContext for the given session.
 * Mirrors the logic in BaseAgentRunner.createToolContext().
 */
async function buildToolContext(
	session: ActiveSession,
	toolResultMap: Map<string, boolean>,
): Promise<ToolContext> {
	const { getProjectRoot } = await import("@/backend/projectRoot");
	const projectRoot = getProjectRoot();

	if (session.contextType === "channel") {
		return await createChannelToolContext(
			projectRoot,
			session.contextId,
			session.id,
			toolResultMap,
		);
	}

	if (session.contextType === "roadmap") {
		return await createRoadmapToolContext(
			projectRoot,
			session.contextId,
			session.id,
			toolResultMap,
			undefined,
			session.agentRole,
		);
	}

	if (session.contextType === "subtask") {
		const db = await getProjectDb(projectRoot);
		const subtask = await db
			.selectFrom("subtasks")
			.where("id", "=", session.contextId)
			.selectAll()
			.executeTakeFirst();

		if (!subtask) {
			throw new Error(`Subtask not found: ${session.contextId}`);
		}

		const ctx = await createWorkflowToolContext(
			projectRoot,
			subtask.workflow_id,
			session.id,
			toolResultMap,
			undefined,
			undefined, // worktreePath — will be resolved from workflow
			session.agentRole,
		);

		return { ...ctx, subtaskId: session.contextId };
	}

	if (session.contextType === "persona") {
		const db = await getProjectDb(projectRoot);
		const personaRecord = await db
			.selectFrom("persona_roadmaps")
			.where("id", "=", session.contextId)
			.selectAll()
			.executeTakeFirst();

		if (!personaRecord) {
			throw new Error(`Persona roadmap not found: ${session.contextId}`);
		}

		const ctx = await createRoadmapToolContext(
			projectRoot,
			personaRecord.roadmap_id,
			session.id,
			toolResultMap,
			undefined,
			session.agentRole,
		);

		return { ...ctx, personaRoadmapId: session.contextId };
	}

	// Default: workflow context
	return await createWorkflowToolContext(
		projectRoot,
		session.contextId,
		session.id,
		toolResultMap,
		undefined,
		undefined, // worktreePath — set by the runner before spawning claude
		session.agentRole,
	);
}

// =============================================================================
// Terminal Tool Detection
// =============================================================================

/**
 * Check if the executed tool is a terminal tool for this session's role.
 * If so, signal the runner to terminate the Claude Code subprocess.
 *
 * For complete_pulse, only signal on success (failed pulse should let
 * Claude Code continue to fix the issue).
 */
function checkTerminalTool(
	sessionId: string,
	session: ActiveSession,
	toolName: string,
	success: boolean,
): void {
	const terminalTools = TERMINAL_TOOLS[session.agentRole];
	if (!terminalTools?.includes(toolName)) {
		return;
	}

	// For complete_pulse, only terminate on success
	if (toolName === "complete_pulse" && !success) {
		log.agent.info(
			`complete_pulse failed for session ${sessionId} — not terminating`,
		);
		return;
	}

	// request_extension is terminal for nudge detection but should NOT
	// kill the process — it means "continue with another turn"
	if (toolName === "request_extension") {
		return;
	}

	log.agent.info(
		`Terminal tool ${toolName} called for session ${sessionId} — scheduling termination`,
	);
	signalTermination(sessionId);
}
