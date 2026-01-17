import type { ModelScenario } from "@/shared/schemas/settings";
import type { RegisteredTool } from "../tools/types";

// =============================================================================
// Agent Role Types
// =============================================================================

/**
 * Agent role includes all model scenarios plus "preflight"
 * Preflight is an internal role that uses the execution model,
 * so it's not exposed in user-facing model preferences
 */
export type AgentRole = ModelScenario | "preflight";

export interface AgentPromptOptions {
	hasWebCodeSearch?: boolean;
}

/**
 * Configuration for an agent role
 */
export interface AgentConfig {
	/** The agent's role identifier */
	role: AgentRole;
	/** System prompt that defines the agent's behavior and personality */
	systemPrompt: (options: AgentPromptOptions) => string;
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
	systemPrompt: (options: AgentPromptOptions) => string;
	maxTokens?: number;
	temperature?: number;
}
