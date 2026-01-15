/**
 * Tool System
 *
 * Provides tools for agent capabilities, organized by role:
 * - Base tools: Read-only codebase access (all agents)
 * - Pulsing tools: Code modification (pulsing agent)
 * - Preflight tools: Environment setup (preflight agent)
 * - Review tools: Code review (review agent)
 * - Block tools: Structured outputs for stage completion
 *
 * See docs/tools.md for complete specification.
 */

// Base tools (all agents)
export {
	baseTools,
	grepInputSchema,
	grepTool,
	listDirectoryInputSchema,
	listDirectoryTool,
	readFileInputSchema,
	readFileTool,
	semanticSearchInputSchema,
	semanticSearchTool,
	takeNoteInputSchema,
	takeNoteTool,
	webCodeSearchInputSchema,
	webCodeSearchTool,
} from "./base";
// Block tools (structured outputs)
export {
	askQuestionsInputSchema,
	askQuestionsTool,
	blockTools,
	completePreflightInputSchema,
	completePreflightTool,
	completePulseInputSchema,
	completePulseTool,
	requestExtensionInputSchema,
	requestExtensionTool,
	submitPlanInputSchema,
	submitPlanTool,
	submitResearchInputSchema,
	submitResearchTool,
	submitScopeInputSchema,
	submitScopeTool,
} from "./blocks";
// Preflight tools (environment setup)
export {
	preflightTools,
	recordBaselineInputSchema,
	recordBaselineTool,
} from "./preflight";

// Pulsing tools (code modification)
export {
	editFileInputSchema,
	editFileTool,
	multiEditInputSchema,
	multiEditTool,
	pulsingTools,
	shellInputSchema,
	shellTool,
	writeFileInputSchema,
	writeFileTool,
} from "./pulsing";
// Review tools (code review)
export {
	addFileCommentInputSchema,
	addFileCommentTool,
	addLineCommentInputSchema,
	addLineCommentTool,
	addReviewCommentInputSchema,
	addReviewCommentTool,
	completeReviewInputSchema,
	completeReviewTool,
	getDiffInputSchema,
	getDiffTool,
	getScopeCardInputSchema,
	getScopeCardTool,
	reviewTools,
} from "./review";
// Types
export type {
	BaseToolName,
	BlockToolName,
	PreflightToolName,
	PulsingToolName,
	RegisteredTool,
	ReviewToolName,
	ToolContext,
	ToolDefinition,
	ToolName,
	ToolResult,
} from "./types";
export { REASON_DESCRIPTION, registerTool } from "./types";

// =============================================================================
// Tool Registry
// =============================================================================

import { baseTools } from "./base";
import { blockTools } from "./blocks";
import { preflightTools } from "./preflight";
import { pulsingTools } from "./pulsing";
import { reviewTools } from "./review";
import type { RegisteredTool } from "./types";

/** All tools indexed by name */
export const toolRegistry: Record<string, RegisteredTool> = {};

// Register all tools
for (const tool of [
	...baseTools,
	...pulsingTools,
	...preflightTools,
	...reviewTools,
	...blockTools,
]) {
	toolRegistry[tool.name] = tool;
}

/** Get a tool by name */
export function getTool(name: string): RegisteredTool | undefined {
	return toolRegistry[name];
}

/** Get all tool names */
export function getToolNames(): string[] {
	return Object.keys(toolRegistry);
}
