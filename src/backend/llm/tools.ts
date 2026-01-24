/**
 * AI SDK Tool Adapter
 *
 * Converts our RegisteredTool definitions to Vercel AI SDK format.
 * The AI SDK's tool() helper handles schema validation and execution.
 */

import type { Tool } from "ai";
import { tool } from "ai";
import type { RegisteredTool, ToolContext, ToolResult } from "../tools/types";

// =============================================================================
// Types
// =============================================================================

/**
 * A record of AI SDK tools keyed by tool name.
 * This is the format expected by streamText().
 */
export type AISDKToolSet = Record<string, Tool>;

// =============================================================================
// Tool Conversion
// =============================================================================

/**
 * Options for convertToAISDKTools function.
 */
export interface ConvertToAISDKToolsOptions {
	/**
	 * Whether an Exa API key is configured.
	 * When false or undefined, web_code_search tool is excluded.
	 */
	hasExaKey?: boolean;
}

/**
 * Convert an array of RegisteredTools to AI SDK tool format.
 *
 * Filters out tools that require unavailable API keys:
 * - web_code_search requires an Exa API key to be configured
 *
 * @param tools - Array of registered tools from the agent registry
 * @param context - Tool execution context (project root, workflow/channel IDs, etc.)
 * @param options - Optional configuration for tool filtering
 * @param options.hasExaKey - Whether an Exa API key is configured (enables web_code_search)
 * @returns Record of AI SDK tools ready for use with streamText()
 */
export function convertToAISDKTools(
	tools: readonly RegisteredTool[],
	context: ToolContext,
	options?: ConvertToAISDKToolsOptions,
): AISDKToolSet {
	// Filter out tools that require unavailable API keys
	const availableTools = tools.filter((t) => {
		if (t.name === "web_code_search" && !options?.hasExaKey) {
			return false;
		}
		return true;
	});

	return Object.fromEntries(
		availableTools.map((t) => [
			t.name,
			tool({
				description: t.description,
				inputSchema: t.inputSchema,
				execute: async (input: unknown, options) => {
					// Create an extended context that includes the toolCallId from the AI SDK
					// This allows tools (like shell) to use the toolCallId for approval tracking
					const extendedContext: ToolContext = {
						...context,
						toolCallId: options.toolCallId,
					};
					// Execute our tool and convert result to AI SDK format
					const result = await t.execute(input, extendedContext);
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
 * All tools now return plain text output.
 */
function formatToolResult(result: ToolResult): string {
	return result.output;
}

/**
 * Create a tool context for a channel discussion.
 */
export async function createChannelToolContext(
	projectRoot: string,
	channelId: string,
	sessionId: string,
): Promise<ToolContext> {
	return {
		projectRoot,
		channelId,
		sessionId,
	};
}

/**
 * Create a tool context for a workflow execution.
 */
export async function createWorkflowToolContext(
	projectRoot: string,
	workflowId: string,
	sessionId: string,
	turnId?: string,
	worktreePath?: string,
): Promise<ToolContext> {
	return {
		projectRoot,
		workflowId,
		sessionId,
		turnId,
		worktreePath,
	};
}
