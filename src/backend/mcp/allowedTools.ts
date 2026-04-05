/**
 * Claude Code Allowed Tools per Agent Role
 *
 * Maps each Autarch agent role to the `--allowedTools` string passed to `claude -p`.
 * This is the security boundary — Claude Code can ONLY use these tools.
 *
 * Explicitly blocked (never in any allowedTools list):
 * - Bash — shell goes through MCP (mcp__autarch__shell) to preserve approval flow
 * - Agent — prevents untracked subagent work outside Autarch's orchestrator
 * - TodoWrite, NotebookEdit, plan/worktree/team tools — not applicable
 */

import type { AgentRole } from "@/backend/agents/types";

/** Read-only native tools available to all roles */
const READ_ONLY = "Read,Glob,Grep,WebFetch,WebSearch";

/** Read-write native tools for execution roles */
const READ_WRITE = "Read,Write,Edit,Glob,Grep,WebFetch,WebSearch";

/** MCP wildcard to allow all Autarch MCP tools */
const MCP_WILDCARD = "mcp__autarch__*";

const ALLOWED_TOOLS_BY_ROLE: Record<AgentRole, string> = {
	// Read-only roles
	basic: `${READ_ONLY},${MCP_WILDCARD}`,
	discussion: `${READ_ONLY},${MCP_WILDCARD}`,
	scoping: `${READ_ONLY},${MCP_WILDCARD}`,
	research: `${READ_ONLY},${MCP_WILDCARD}`,
	planning: `${READ_ONLY},${MCP_WILDCARD}`,
	review: `${READ_ONLY},${MCP_WILDCARD}`,
	review_sub: `${READ_ONLY},${MCP_WILDCARD}`,
	roadmap_planning: `${READ_ONLY},${MCP_WILDCARD}`,
	visionary: `${READ_ONLY},${MCP_WILDCARD}`,
	iterative: `${READ_ONLY},${MCP_WILDCARD}`,
	tech_lead: `${READ_ONLY},${MCP_WILDCARD}`,
	pathfinder: `${READ_ONLY},${MCP_WILDCARD}`,
	synthesis: `${READ_ONLY},${MCP_WILDCARD}`,

	// Read-write roles
	execution: `${READ_WRITE},${MCP_WILDCARD}`,
	preflight: `${READ_ONLY},${MCP_WILDCARD}`,
};

/**
 * Get the `--allowedTools` value for a given agent role.
 */
export function getAllowedTools(role: AgentRole): string {
	return ALLOWED_TOOLS_BY_ROLE[role];
}
