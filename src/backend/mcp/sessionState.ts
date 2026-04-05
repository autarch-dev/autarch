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
