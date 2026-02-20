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
export { reviewSubPrompt } from "./reviewSub";
export { iterativeImprovementsPrompt } from "./roadmap/iterative";
export { strategicPathfinderPrompt } from "./roadmap/pathfinder";
export { synthesisMediatorPrompt } from "./roadmap/synthesis";
export { techLeadPrompt } from "./roadmap/techLead";
export { visionaryFounderPrompt } from "./roadmap/visionary";
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
import { reviewSubPrompt } from "./reviewSub";
import { iterativeImprovementsPrompt } from "./roadmap/iterative";
import { strategicPathfinderPrompt } from "./roadmap/pathfinder";
import { synthesisMediatorPrompt } from "./roadmap/synthesis";
import { techLeadPrompt } from "./roadmap/techLead";
import { visionaryFounderPrompt } from "./roadmap/visionary";
import { roadmapPlanningPrompt } from "./roadmapPlanning";
import { scopingPrompt } from "./scoping";

/** Map of role to system prompt */
export const agentPrompts = {
	basic: () => basicPrompt,
	discussion: () => discussionPrompt,
	scoping: (options) => scopingPrompt(options),
	research: getResearchPrompt,
	planning: (options) => planningPrompt(options),
	preflight: () => preflightPrompt,
	execution: (options) => executionPrompt(options),
	review: (options) => reviewPrompt(options),
	review_sub: reviewSubPrompt,
	roadmap_planning: () => roadmapPlanningPrompt,
	visionary: (options) => visionaryFounderPrompt(options.submitToolName),
	iterative: (options) => iterativeImprovementsPrompt(options.submitToolName),
	tech_lead: (options) => techLeadPrompt(options.submitToolName),
	pathfinder: (options) => strategicPathfinderPrompt(options.submitToolName),
	synthesis: () => synthesisMediatorPrompt,
} as const satisfies Record<AgentRole, (options: AgentPromptOptions) => string>;

/** Get the system prompt for an agent role */
export function getPromptForRole(
	role: AgentRole,
	options: AgentPromptOptions,
): string {
	return `${agentPrompts[role](options)}
	
## Tool Calling: Reason

When invoking tools, you must provide a \`reason\` for why you are calling the tool.
This reason will be used to help the user understand what you are doing.
Keep it short and to the point.

Example:
\`\`\`json
{
	"reason": "Add Channels property to ViewModel used by ChannelListView"
	[... other tool parameters ...]
}
\`\`\`
`;
}
