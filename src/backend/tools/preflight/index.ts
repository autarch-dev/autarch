/**
 * Preflight tools - Environment setup tools for the preflight agent
 */

import { listDirectoryTool, readFileTool } from "../base";
import { shellTool } from "../pulsing/shell";

// Re-export shell tool (same implementation, different context)
export { shellTool as preflightShellTool } from "../pulsing/shell";

// Array of all preflight tools (registered for type-erased storage)
import { registerTool } from "../types";

export const preflightTools = [
	registerTool(listDirectoryTool),
	registerTool(readFileTool),
	registerTool(shellTool),
];
