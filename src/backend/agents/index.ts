/**
 * Agent System
 *
 * Multi-agent architecture where each ModelScenario maps 1:1 to an agent
 * with its own system prompt and tool set.
 *
 * Usage:
 * ```typescript
 * import { getAgentConfig } from "@/backend/agents";
 *
 * const config = getAgentConfig("execution");
 * // Returns: { role, systemPrompt, tools, maxTokens, temperature }
 * ```
 */

// Re-export prompts
export { agentPrompts, getPromptForRole } from "./prompts";
// Re-export registry
export {
	agentRegistry,
	getAgentConfig,
	getAllRoles,
	getToolsForRole,
	roleHasTool,
} from "./registry";
// Re-export types
export type { AgentConfig, AgentPromptConfig, AgentRole } from "./types";
