/**
 * System prompts for each agent role
 */

export { basicPrompt } from "./basic";
export { discussionPrompt } from "./discussion";
export { executionPrompt } from "./execution";
export { planningPrompt } from "./planning";
export { preflightPrompt } from "./preflight";
export { researchPrompt } from "./research";
export { reviewPrompt } from "./review";
export { scopingPrompt } from "./scoping";

import type { AgentRole } from "../types";
import { basicPrompt } from "./basic";
import { discussionPrompt } from "./discussion";
import { executionPrompt } from "./execution";
import { planningPrompt } from "./planning";
import { preflightPrompt } from "./preflight";
import { researchPrompt } from "./research";
import { reviewPrompt } from "./review";
import { scopingPrompt } from "./scoping";

/** Map of role to system prompt */
export const agentPrompts = {
	basic: basicPrompt,
	discussion: discussionPrompt,
	scoping: scopingPrompt,
	research: researchPrompt,
	planning: planningPrompt,
	preflight: preflightPrompt,
	execution: executionPrompt,
	review: reviewPrompt,
} as const satisfies Record<AgentRole, string>;

/** Get the system prompt for an agent role */
export function getPromptForRole(role: AgentRole): string {
	return agentPrompts[role];
}
