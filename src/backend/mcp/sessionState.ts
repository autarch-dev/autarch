/**
 * Shared state between ClaudeCodeRunner and the MCP handler.
 *
 * Lives in the mcp/ directory to avoid circular imports.
 * The runner writes to these maps; the MCP handler reads from them.
 */

/**
 * Maps Autarch session IDs to Claude Code session IDs.
 * Used for --resume across nudge/continue calls.
 */
export const ccSessionIds = new Map<string, string>();

/**
 * Maps Autarch session IDs to the currently active assistant turn ID.
 * Used by the MCP handler to set turn_id on artifacts (scope cards, etc.)
 * so the UI can position them in the conversation.
 */
export const activeTurnIds = new Map<string, string>();

/**
 * Maps Autarch session IDs to the worktree path (if any).
 * Used by the MCP handler to set worktreePath on ToolContext so tools
 * operate in the correct worktree during pulsing.
 */
export const activeWorktreePaths = new Map<string, string>();

/**
 * Maps LLM-generated tool_call_id → Anthropic toolu_ ID.
 *
 * The stream parser sees both: the Anthropic tool call ID (from content_block_start)
 * and the tool_call_id schema field (from the parsed input JSON at tool_call_end).
 * It stores the mapping here.
 *
 * The MCP handler reads tool_call_id from its input, looks up the Anthropic ID,
 * and sets it on ToolContext.toolCallId for shell approval routing, etc.
 */
export const toolCallCorrelation = new Map<string, string>();
