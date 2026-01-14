import type { ModelScenario } from "@/shared/schemas/settings";
import type { RegisteredTool } from "../tools/types";

// =============================================================================
// Agent Role Types
// =============================================================================

/**
 * Agent role is derived directly from ModelScenario
 * Each scenario maps 1:1 to an agent with specific capabilities
 */
export type AgentRole = ModelScenario;

/**
 * Configuration for an agent role
 */
export interface AgentConfig {
	/** The agent's role identifier */
	role: AgentRole;
	/** System prompt that defines the agent's behavior and personality */
	systemPrompt: string;
	/** Tools available to this agent (type-erased for storage) */
	tools: readonly RegisteredTool[];
	/** Optional max tokens override for this agent's responses */
	maxTokens?: number;
	/** Optional temperature override */
	temperature?: number;
}

/**
 * Minimal agent config without tools (for registration before tools are loaded)
 */
export interface AgentPromptConfig {
	role: AgentRole;
	systemPrompt: string;
	maxTokens?: number;
	temperature?: number;
}
