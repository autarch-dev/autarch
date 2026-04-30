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
import { z } from "zod";
import { TERMINAL_TOOLS } from "@/backend/agents/runner/BaseAgentRunner";
import { getSessionManager } from "@/backend/agents/runner/SessionManager";
import type { ActiveSession } from "@/backend/agents/runner/types";
// getAgentConfig is lazy-imported in createMcpServerForRequest to avoid
// circular dependency: McpServer → registry → tools → blocks (not yet initialized)
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
import {
	activeTurnIds,
	activeWorktreePaths,
	awaitCorrelation,
	deleteCorrelation,
	terminalToolsFired,
} from "./sessionState";
import { isMcpTool } from "./toolClassification";

// =============================================================================
// MCP Server Factory
// =============================================================================

/**
 * Create a fresh MCP server for a single request.
 *
 * The MCP SDK's McpServer can only be connected to one transport at a time,
 * and stateless HTTP mode creates a new transport per request. So we create
 * a new McpServer per request as well. Tool registration is cheap — it's
 * just building a handler map, no I/O.
 *
 * Looks up the session's agent role to filter tools — only tools assigned
 * to that role in the agent registry are exposed via MCP.
 */
export async function createMcpServerForRequest(
	sessionId: string,
): Promise<McpServer> {
	// Look up the session to determine which tools to expose
	const sessionManager = getSessionManager();
	const session = await sessionManager.getOrRestoreSession(sessionId);

	let allowedToolNames: Set<string> | null = null;
	if (session) {
		const { resolveToolsForSession } =
			require("@/backend/agents/registry") as typeof import("@/backend/agents/registry");
		const tools = resolveToolsForSession(
			session.agentRole,
			session.contextType,
		);
		allowedToolNames = new Set(tools.map((t: { name: string }) => t.name));
	}

	return createMcpServer(sessionId, allowedToolNames);
}

/**
 * Clean up an MCP server when a session ends.
 * No-op in stateless mode since servers are created per-request.
 */
export async function cleanupMcpServer(_sessionId: string): Promise<void> {
	// Stateless mode: nothing to clean up
}

// =============================================================================
// MCP Server Creation
// =============================================================================

function createMcpServer(
	sessionId: string,
	allowedToolNames: Set<string> | null,
): McpServer {
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

	// Register MCP-classified tools that this role has access to
	for (const [toolName, registeredTool] of Object.entries(toolRegistry)) {
		if (!isMcpTool(toolName)) {
			continue;
		}
		// If we know the role's tools, filter to only those
		if (allowedToolNames && !allowedToolNames.has(toolName)) {
			continue;
		}

		// Extend the tool's input schema with tool_call_id for MCP↔stream correlation
		const extendedSchema = (
			registeredTool.inputSchema as z.ZodObject<z.ZodRawShape>
		).extend({
			tool_call_id: z
				.string()
				.describe(
					"Required. A unique identifier for this tool call. Generate a short, unique string for each call (e.g. 'find_sym_1', 'shell_build_check').",
				),
		});

		server.registerTool(
			toolName,
			{
				description: registeredTool.description,
				inputSchema: extendedSchema,
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

	// Correlate MCP call → Anthropic tool call ID via the LLM-generated tool_call_id field.
	// The stream parser resolves the deferred promise when it sees the tool input.
	// If the MCP handler runs first (race), it awaits until the stream catches up.
	const inputObj = input as Record<string, unknown> | undefined;
	if (inputObj?.tool_call_id && typeof inputObj.tool_call_id === "string") {
		const schemaToolCallId = inputObj.tool_call_id as string;
		const anthropicId = await awaitCorrelation(schemaToolCallId);
		toolContext.toolCallId = anthropicId;
		deleteCorrelation(schemaToolCallId);
	}

	try {
		log.tools.info(`[MCP] Executing ${toolName}...`);
		const result = await registeredTool.execute(input, toolContext);
		log.tools.info(
			`[MCP] ${toolName} returned: success=${result.success} outputLen=${result.output.length}`,
		);

		// Check if this is a terminal tool that should end the session
		checkTerminalTool(sessionId, session, toolName, result.success);

		const response = {
			content: [{ type: "text" as const, text: result.output }],
			isError: !result.success,
		};
		log.tools.info(`[MCP] Returning response for ${toolName}`);
		return response;
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

	// Get shared state from the runner (turn ID for artifacts, worktree for file ops)
	const turnId = activeTurnIds.get(session.id);
	const worktreePath = activeWorktreePaths.get(session.id);

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
			turnId,
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
			turnId,
			worktreePath,
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
			turnId,
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
		turnId,
		worktreePath,
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
		const ext = terminalToolsFired.get(sessionId) ?? [];
		ext.push(toolName);
		terminalToolsFired.set(sessionId, ext);
		return;
	}

	// Record the terminal tool so maybeNudge knows it fired
	const existing = terminalToolsFired.get(sessionId) ?? [];
	existing.push(toolName);
	terminalToolsFired.set(sessionId, existing);

	log.agent.info(
		`Terminal tool ${toolName} called for session ${sessionId} — scheduling termination`,
	);
	signalTermination(sessionId);
}
