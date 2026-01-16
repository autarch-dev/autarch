/**
 * Preflight tools - Environment setup tools for the preflight agent
 */

import { shellTool } from "../pulsing/shell";

// Re-export shell tool (same implementation, different context)
export { shellTool as preflightShellTool } from "../pulsing/shell";
export {
	type RecordBaselineInput,
	recordBaselineInputSchema,
	recordBaselineTool,
} from "./recordBaseline";

// Array of all preflight tools (registered for type-erased storage)
import { registerTool } from "../types";
import { recordBaselineTool } from "./recordBaseline";

export const preflightTools = [
	registerTool(shellTool),
	registerTool(recordBaselineTool),
];
