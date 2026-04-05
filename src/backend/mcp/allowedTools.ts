/**
 * Claude Code Tool Restrictions per Agent Role
 *
 * Maps each Autarch agent role to the `--tools` string passed to `claude -p`.
 * This restricts which tools Claude Code can use — unlisted tools are unavailable.
 *
 * All roles get: Read, Glob, Grep, WebFetch, WebSearch + mcp__autarch__* (MCP tools)
 *
 * Routed through MCP (not native) to preserve Autarch hooks:
 * - shell → mcp__autarch__shell (approval flow, timeouts, output truncation)
 * - write_file, edit_file, multi_edit → MCP (post-write lint fix, error catching)
 *
 * Explicitly unavailable:
 * - Bash, Write, Edit — file writes and shell go through MCP
 * - Agent — prevents untracked subagent work
 * - TodoWrite, NotebookEdit, plan/worktree/team tools
 */

import type { AgentRole } from "@/backend/agents/types";

/** Native tools available to all roles (read-only + web) */
const BASE_TOOLS = "Read,Glob,Grep,WebFetch,WebSearch";

/** MCP wildcard to allow all Autarch MCP tools */
const MCP_WILDCARD = "mcp__autarch__*";

const ALLOWED_TOOLS_BY_ROLE: Record<AgentRole, string> = {
	// Read-only roles
	basic: `${BASE_TOOLS},${MCP_WILDCARD}`,
	discussion: `${BASE_TOOLS},${MCP_WILDCARD}`,
	scoping: `${BASE_TOOLS},${MCP_WILDCARD}`,
	research: `${BASE_TOOLS},${MCP_WILDCARD}`,
	planning: `${BASE_TOOLS},${MCP_WILDCARD}`,
	review: `${BASE_TOOLS},${MCP_WILDCARD}`,
	review_sub: `${BASE_TOOLS},${MCP_WILDCARD}`,
	roadmap_planning: `${BASE_TOOLS},${MCP_WILDCARD}`,
	visionary: `${BASE_TOOLS},${MCP_WILDCARD}`,
	iterative: `${BASE_TOOLS},${MCP_WILDCARD}`,
	tech_lead: `${BASE_TOOLS},${MCP_WILDCARD}`,
	pathfinder: `${BASE_TOOLS},${MCP_WILDCARD}`,
	synthesis: `${BASE_TOOLS},${MCP_WILDCARD}`,

	// Read-write roles
	execution: `${BASE_TOOLS},${MCP_WILDCARD}`,
	preflight: `${BASE_TOOLS},${MCP_WILDCARD}`,
};

/**
 * Get the `--allowedTools` value for a given agent role.
 */
export function getAllowedTools(role: AgentRole): string {
	return ALLOWED_TOOLS_BY_ROLE[role];
}
