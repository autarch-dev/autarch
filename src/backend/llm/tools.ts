/**
 * AI SDK Tool Adapter
 *
 * Converts our RegisteredTool definitions to Vercel AI SDK format.
 * The AI SDK's tool() helper handles schema validation and execution.
 */

import type { CoreTool } from "ai";
import { tool } from "ai";
import type { RegisteredTool, ToolContext, ToolResult } from "../tools/types";

// =============================================================================
// Types
// =============================================================================

/**
 * A record of AI SDK tools keyed by tool name.
 * This is the format expected by streamText().
 */
export type AISDKToolSet = Record<string, CoreTool>;

// =============================================================================
// Tool Conversion
// =============================================================================

/**
 * Convert an array of RegisteredTools to AI SDK tool format.
 *
 * @param tools - Array of registered tools from the agent registry
 * @param context - Tool execution context (project root, workflow/channel IDs, etc.)
 * @returns Record of AI SDK tools ready for use with streamText()
 */
export function convertToAISDKTools(
	tools: readonly RegisteredTool[],
	context: ToolContext,
): AISDKToolSet {
	return Object.fromEntries(
		tools.map((t) => [
			t.name,
			tool({
				description: t.description,
				parameters: t.inputSchema,
				execute: async (input) => {
					// Execute our tool and convert result to AI SDK format
					const result = await t.execute(input, context);
					return formatToolResult(result);
				},
			}),
		]),
	);
}

/**
 * Format our ToolResult for the AI SDK.
 *
 * The AI SDK expects either the raw result or an error.
 * We convert our structured result to a format the LLM can understand.
 */
function formatToolResult(result: ToolResult): unknown {
	if (result.success) {
		return result.data;
	}

	// Return error information in a structured way the LLM can understand
	return {
		error: true,
		message: result.error ?? "Tool execution failed",
		blocked: result.blocked,
		reason: result.reason,
	};
}

/**
 * Create a tool context for a channel discussion.
 */
export function createChannelToolContext(
	projectRoot: string,
	channelId: string,
	sessionId: string,
): ToolContext {
	return {
		projectRoot,
		channelId,
		sessionId,
	};
}

/**
 * Create a tool context for a workflow execution.
 */
export function createWorkflowToolContext(
	projectRoot: string,
	workflowId: string,
	sessionId: string,
	worktreePath?: string,
): ToolContext {
	return {
		projectRoot,
		workflowId,
		sessionId,
		worktreePath,
	};
}
