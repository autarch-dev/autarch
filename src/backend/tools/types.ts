/**
 * Tool system types
 *
 * All tools follow a consistent pattern with Zod schemas for validation.
 * See docs/tools.md for the complete tool specification.
 */

import type { z } from "zod";

// =============================================================================
// Tool Definition
// =============================================================================

/**
 * Context passed to every tool execution
 */
export interface ToolContext {
	/** Absolute path to the project root */
	projectRoot: string;
	/** Current workflow ID (if in a workflow context) */
	workflowId?: string;
	/** Current session ID */
	sessionId?: string;
	/** Current turn ID (for artifact timeline ordering) */
	turnId?: string;
	/** Path to isolated worktree (for pulsing agent) */
	worktreePath?: string;
	/** Current channel ID (if in a channel context) */
	channelId?: string;
}

/**
 * Result returned from tool execution.
 * All tool outputs are plain text strings.
 */
export interface ToolResult {
	success: boolean;
	output: string;
}

/**
 * Tool definition with typed input schema.
 * All tools return plain text output.
 */
export interface ToolDefinition<TInput> {
	/** Unique tool name (snake_case) */
	name: string;
	/** Human-readable description for the LLM */
	description: string;
	/** Zod schema for input validation */
	inputSchema: z.ZodType<TInput>;
	/** Execute the tool with validated input, returns plain text */
	execute: (input: TInput, context: ToolContext) => Promise<ToolResult>;
}

/**
 * Type-erased tool definition for storage in registries and arrays.
 * Input is validated through the schema before execution.
 */
export interface RegisteredTool {
	name: string;
	description: string;
	inputSchema: z.ZodType;
	/**
	 * Execute with runtime-validated input.
	 * The input has been validated against inputSchema before this is called.
	 */
	execute: (input: unknown, context: ToolContext) => Promise<ToolResult>;
}

/**
 * Convert a typed ToolDefinition to a RegisteredTool for storage.
 * Wraps execute to validate input through the schema first.
 */
export function registerTool<TInput>(
	tool: ToolDefinition<TInput>,
): RegisteredTool {
	return {
		name: tool.name,
		description: tool.description,
		inputSchema: tool.inputSchema,
		execute: async (input: unknown, context: ToolContext) => {
			const validated = tool.inputSchema.parse(input);
			return tool.execute(validated, context);
		},
	};
}

// =============================================================================
// Tool Categories
// =============================================================================

/**
 * Base tools available to all agents (read-only codebase access)
 */
export type BaseToolName =
	| "semantic_search"
	| "read_file"
	| "list_directory"
	| "grep"
	| "take_note"
	| "web_code_search";

/**
 * Pulsing agent tools (code modification)
 */
export type PulsingToolName =
	| "write_file"
	| "edit_file"
	| "multi_edit"
	| "shell";

/**
 * Preflight agent tools
 */
export type PreflightToolName = "shell" | "record_baseline";

/**
 * Review agent tools
 */
export type ReviewToolName =
	| "get_diff"
	| "get_scope_card"
	| "add_line_comment"
	| "add_file_comment"
	| "add_review_comment"
	| "complete_review";

/**
 * Block-based structured output tools (stage completion)
 */
export type BlockToolName =
	| "submit_scope"
	| "submit_research"
	| "submit_plan"
	| "request_extension"
	| "ask_questions"
	| "complete_pulse"
	| "complete_preflight";

/** All tool names */
export type ToolName =
	| BaseToolName
	| PulsingToolName
	| PreflightToolName
	| ReviewToolName
	| BlockToolName;

// =============================================================================
// Common Parameters
// =============================================================================

/**
 * All tools require a reason parameter for traceability
 */
export const REASON_DESCRIPTION =
	'Required. A short, human-readable statement of the logical purpose of this tool call (e.g. "Add Channels property to ViewModel used by ChannelListView"). Do not describe the tool operation itself.';
