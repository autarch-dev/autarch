/**
 * Route exports
 *
 * Combines all API routes into a single export for the server.
 */

export { channelRoutes } from "./channelRoutes";
export { costRoutes } from "./costRoutes";
export { credentialPromptRoutes } from "./credentialPromptRoutes";
export { questionRoutes } from "./questionRoutes";
export { roadmapRoutes } from "./roadmapRoutes";
export { sessionRoutes } from "./sessionRoutes";
export { settingsRoutes } from "./settings";
export { shellApprovalRoutes } from "./shellApprovalRoutes";
export { toolRoutes } from "./toolRoutes";
export { workflowRoutes } from "./workflowRoutes";

// Combined routes for easy import
import { channelRoutes } from "./channelRoutes";
import { costRoutes } from "./costRoutes";
import { credentialPromptRoutes } from "./credentialPromptRoutes";
import { questionRoutes } from "./questionRoutes";
import { roadmapRoutes } from "./roadmapRoutes";
import { sessionRoutes } from "./sessionRoutes";
import { shellApprovalRoutes } from "./shellApprovalRoutes";
import { toolRoutes } from "./toolRoutes";
import { workflowRoutes } from "./workflowRoutes";

/**
 * All agent-related API routes combined.
 * Use this to spread into your server routes.
 */
export const agentRoutes = {
	...workflowRoutes,
	...channelRoutes,
	// Note: credentialPromptRoutes includes a POST endpoint called by the
	// askpass shell/cmd script (not the browser). Auth middleware must not gate it.
	...credentialPromptRoutes,
	...sessionRoutes,
	...questionRoutes,
	...shellApprovalRoutes,
	...toolRoutes,
	...roadmapRoutes,
	...costRoutes,
};
