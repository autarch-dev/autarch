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
 * Deferred correlation: LLM-generated tool_call_id → Anthropic toolu_ ID.
 *
 * The MCP handler may execute before the stream parser has seen the full
 * tool input (race between HTTP dispatch and stdout streaming). So we use
 * a deferred promise pattern:
 *
 * - MCP handler calls `awaitCorrelation(schemaId)` → gets a Promise<string>
 * - Stream parser calls `resolveCorrelation(schemaId, anthropicId)` when it
 *   parses the tool_call_id from the streamed input
 * - If the stream parser ran first, the promise resolves immediately
 */
const correlationResolvers = new Map<
	string,
	{ promise: Promise<string>; resolve: (id: string) => void }
>();

/**
 * Await the Anthropic tool call ID for a given schema tool_call_id.
 * Called by the MCP handler. Returns immediately if already resolved.
 */
function getOrCreateDeferred(schemaToolCallId: string) {
	const existing = correlationResolvers.get(schemaToolCallId);
	if (existing) return existing;

	let resolve: (id: string) => void = () => {};
	const promise = new Promise<string>((r) => {
		resolve = r;
	});
	const deferred = { promise, resolve };
	correlationResolvers.set(schemaToolCallId, deferred);
	return deferred;
}

/**
 * Await the Anthropic tool call ID for a given schema tool_call_id.
 * Called by the MCP handler. Returns immediately if already resolved.
 */
export function awaitCorrelation(schemaToolCallId: string): Promise<string> {
	return getOrCreateDeferred(schemaToolCallId).promise;
}

/**
 * Resolve the Anthropic tool call ID for a given schema tool_call_id.
 * Called by the stream parser at tool_call_end.
 */
export function resolveCorrelation(
	schemaToolCallId: string,
	anthropicId: string,
): void {
	getOrCreateDeferred(schemaToolCallId).resolve(anthropicId);
}

/**
 * Clean up a correlation entry after use.
 */
export function deleteCorrelation(schemaToolCallId: string): void {
	correlationResolvers.delete(schemaToolCallId);
}

/**
 * Tracks terminal tool names that fired via MCP for each session.
 * The ClaudeCodeRunner checks this in maybeNudge to avoid nudging
 * when a terminal tool already executed via MCP.
 */
export const terminalToolsFired = new Map<string, string[]>();
