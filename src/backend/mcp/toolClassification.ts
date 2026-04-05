/**
 * Tool Classification
 *
 * Single source of truth for which tools Claude Code handles natively
 * vs. which are exposed through the Autarch MCP server.
 */

import type { ToolName } from "@/backend/tools/types";

/**
 * Tools that Claude Code handles natively via its built-in capabilities.
 * These are NOT exposed through the MCP server.
 *
 * Mapping:
 * - read_file → Claude Code `Read`
 * - list_directory → Claude Code `Glob`
 * - grep → Claude Code `Grep`
 *
 * NOTE: write_file, edit_file, multi_edit are routed through MCP (not native)
 * to preserve Autarch's post-write hooks (lint fix, error catching).
 */
export const NATIVE_TOOLS: ReadonlySet<string> = new Set<ToolName>([
	"read_file",
	"list_directory",
	"grep",
]);

/**
 * Tools exposed through the Autarch MCP server (~23 tools).
 * Claude Code calls these via the `mcp__autarch__<name>` convention.
 *
 * Includes `shell` — routed through MCP to preserve Autarch's
 * approval flow, timeouts, and output truncation.
 */
export const MCP_TOOLS: ReadonlySet<string> = new Set<string>([
	// Shell (via MCP to preserve approval flow)
	"shell",
	// File writes (via MCP to preserve post-write hooks)
	"write_file",
	"edit_file",
	"multi_edit",
	// Base (Autarch-specific)
	"semantic_search",
	"take_note",
	"web_code_search",
	// Todo
	"add_todo",
	"check_todo",
	// Knowledge
	"search_knowledge",
	// TypeScript
	"find_symbol",
	"get_symbol",
	"list_exports",
	// Preflight
	"record_baseline",
	// Review
	"get_diff",
	"get_scope_card",
	"add_line_comment",
	"add_file_comment",
	"add_review_comment",
	"complete_review",
	"spawn_review_tasks",
	"submit_sub_review",
	// Blocks (workflow lifecycle)
	"submit_scope",
	"submit_research",
	"submit_plan",
	"submit_roadmap",
	"submit_persona_roadmap",
	"request_extension",
	"ask_questions",
	"complete_pulse",
	"complete_preflight",
]);

/**
 * Check whether a tool should be exposed via MCP.
 */
export function isMcpTool(toolName: string): boolean {
	return MCP_TOOLS.has(toolName);
}

/**
 * Check whether a tool is handled natively by Claude Code.
 */
export function isNativeTool(toolName: string): boolean {
	return NATIVE_TOOLS.has(toolName);
}
