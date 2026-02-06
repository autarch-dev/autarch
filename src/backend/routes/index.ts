/**
 * Route exports
 *
 * Combines all API routes into a single export for the server.
 */

export { channelRoutes } from "./channelRoutes";
export { questionRoutes } from "./questionRoutes";
export { roadmapRoutes } from "./roadmapRoutes";
export { sessionRoutes } from "./sessionRoutes";
export { settingsRoutes } from "./settings";
export { shellApprovalRoutes } from "./shellApprovalRoutes";
export { toolRoutes } from "./toolRoutes";
export { workflowRoutes } from "./workflowRoutes";

// Combined routes for easy import
import { channelRoutes } from "./channelRoutes";
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
	...sessionRoutes,
	...questionRoutes,
	...shellApprovalRoutes,
	...toolRoutes,
	...roadmapRoutes,
};
