/**
 * Agent Registry
 *
 * Maps each agent role to its configuration including
 * system prompt and available tools.
 *
 * Tool assignments based on docs/tools.md specification.
 */

import {
	baseTools,
	preflightTools,
	pulsingTools,
	type RegisteredTool,
	registerTool,
	reviewTools,
} from "../tools";
import {
	askQuestionsTool,
	completePreflightTool,
	completePulseTool,
	requestExtensionTool,
	submitPlanTool,
	submitResearchTool,
	submitScopeTool,
} from "../tools/blocks";
import { typescriptTools } from "../tools/typescript";
import { agentPrompts } from "./prompts";
import type { AgentConfig, AgentRole } from "./types";

// =============================================================================
// Tool Sets by Role (per docs/tools.md)
// =============================================================================

/** Basic agent: no tools */
const BASIC_TOOLS: RegisteredTool[] = [];

/** Discussion agent: base tools (read-only) */
const DISCUSSION_TOOLS: RegisteredTool[] = [...baseTools, ...typescriptTools];

/** Scoping agent: base tools + submit_scope + ask_questions */
const SCOPING_TOOLS: RegisteredTool[] = [
	...baseTools,
	...typescriptTools,
	registerTool(submitScopeTool),
	registerTool(askQuestionsTool),
	registerTool(requestExtensionTool),
];

/** Research agent: base tools + submit_research + request_extension + ask_questions */
const RESEARCH_TOOLS: RegisteredTool[] = [
	...baseTools,
	...typescriptTools,
	registerTool(submitResearchTool),
	registerTool(requestExtensionTool),
	registerTool(askQuestionsTool),
];

/** Planning agent: base tools + submit_plan */
const PLANNING_TOOLS: RegisteredTool[] = [
	...baseTools,
	...typescriptTools,
	registerTool(submitPlanTool),
	registerTool(requestExtensionTool),
];

/** Preflight agent: preflight tools + complete_preflight */
const PREFLIGHT_TOOLS: RegisteredTool[] = [
	...preflightTools,
	...typescriptTools,
	registerTool(completePreflightTool),
];

/** Execution (Pulsing) agent: base tools + pulsing tools + complete_pulse + request_extension */
const EXECUTION_TOOLS: RegisteredTool[] = [
	...baseTools,
	...pulsingTools,
	...typescriptTools,
	registerTool(completePulseTool),
	registerTool(requestExtensionTool),
];

/** Review agent: base tools + review tools */
const REVIEW_TOOLS: RegisteredTool[] = [
	...baseTools,
	...reviewTools,
	...typescriptTools,
	registerTool(requestExtensionTool),
];

// =============================================================================
// Agent Registry
// =============================================================================

/**
 * Complete configuration for each agent role
 */
export const agentRegistry = {
	basic: {
		role: "basic",
		systemPrompt: agentPrompts.basic,
		tools: BASIC_TOOLS,
		maxTokens: 1024,
		temperature: 0.3,
	},
	discussion: {
		role: "discussion",
		systemPrompt: agentPrompts.discussion,
		tools: DISCUSSION_TOOLS,
		maxTokens: 4096,
		temperature: 0.7,
	},
	scoping: {
		role: "scoping",
		systemPrompt: agentPrompts.scoping,
		tools: SCOPING_TOOLS,
		maxTokens: 4096,
		temperature: 0.7,
	},
	research: {
		role: "research",
		systemPrompt: agentPrompts.research,
		tools: RESEARCH_TOOLS,
		maxTokens: 8192,
		temperature: 0.6,
	},
	planning: {
		role: "planning",
		systemPrompt: agentPrompts.planning,
		tools: PLANNING_TOOLS,
		maxTokens: 8192,
		temperature: 0.5,
	},
	preflight: {
		role: "preflight",
		systemPrompt: agentPrompts.preflight,
		tools: PREFLIGHT_TOOLS,
		maxTokens: 4096,
		temperature: 0.5,
	},
	execution: {
		role: "execution",
		systemPrompt: agentPrompts.execution,
		tools: EXECUTION_TOOLS,
		maxTokens: 8192,
		temperature: 0.5,
	},
	review: {
		role: "review",
		systemPrompt: agentPrompts.review,
		tools: REVIEW_TOOLS,
		maxTokens: 4096,
		temperature: 0.5,
	},
} as const satisfies Record<AgentRole, AgentConfig>;

// =============================================================================
// Public API
// =============================================================================

/**
 * Get the complete configuration for an agent role
 */
export function getAgentConfig(role: AgentRole): AgentConfig {
	return agentRegistry[role];
}

/**
 * Get the tools available to an agent role
 */
export function getToolsForRole(role: AgentRole): readonly RegisteredTool[] {
	return agentRegistry[role].tools;
}

/**
 * Check if an agent role has access to a specific tool
 */
export function roleHasTool(role: AgentRole, toolName: string): boolean {
	return agentRegistry[role].tools.some((t) => t.name === toolName);
}

/**
 * Get all agent roles
 */
export function getAllRoles(): AgentRole[] {
	return Object.keys(agentRegistry) as AgentRole[];
}
