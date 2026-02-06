/**
 * System prompts for each agent role
 */

export { basicPrompt } from "./basic";
export { discussionPrompt } from "./discussion";
export { executionPrompt } from "./execution";
export { planningPrompt } from "./planning";
export { preflightPrompt } from "./preflight";
export { getResearchPrompt } from "./research";
export { reviewPrompt } from "./review";
export { roadmapPlanningPrompt } from "./roadmapPlanning";
export { scopingPrompt } from "./scoping";

import type { AgentPromptOptions, AgentRole } from "../types";
import { basicPrompt } from "./basic";
import { discussionPrompt } from "./discussion";
import { executionPrompt } from "./execution";
import { planningPrompt } from "./planning";
import { preflightPrompt } from "./preflight";
import { getResearchPrompt } from "./research";
import { reviewPrompt } from "./review";
import { roadmapPlanningPrompt } from "./roadmapPlanning";
import { scopingPrompt } from "./scoping";

/** Map of role to system prompt */
export const agentPrompts = {
	basic: () => basicPrompt,
	discussion: () => discussionPrompt,
	scoping: () => scopingPrompt,
	research: getResearchPrompt,
	planning: () => planningPrompt,
	preflight: () => preflightPrompt,
	execution: () => executionPrompt,
	review: () => reviewPrompt,
	roadmap_planning: () => roadmapPlanningPrompt,
} as const satisfies Record<AgentRole, (options: AgentPromptOptions) => string>;

/** Get the system prompt for an agent role */
export function getPromptForRole(
	role: AgentRole,
	options: AgentPromptOptions,
): string {
	return agentPrompts[role](options);
}
