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
	todoTools,
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
// Knowledge tools (agent-accessible knowledge base)
export {
	knowledgeTools,
	searchKnowledgeInputSchema,
	searchKnowledgeTool,
} from "./knowledge";
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
	spawnReviewTasksInputSchema,
	spawnReviewTasksTool,
	submitSubReviewInputSchema,
	submitSubReviewTool,
} from "./review";
// Types
export type {
	BaseToolName,
	BlockToolName,
	PreflightToolName,
	PulsingToolName,
	RegisteredTool,
	ReviewToolName,
	TodoToolName,
	ToolContext,
	ToolDefinition,
	ToolName,
	ToolResult,
} from "./types";
export { REASON_DESCRIPTION, registerTool, ToolResultSchema } from "./types";
// Typescript tools (TypeScript-specific tools)
export {
	findSymbolInputSchema,
	findSymbolTool,
} from "./typescript";

// =============================================================================
// Tool Registry
// =============================================================================

import { baseTools, todoTools } from "./base";
import { blockTools } from "./blocks";
import { knowledgeTools } from "./knowledge";
import { preflightTools } from "./preflight";
import { pulsingTools } from "./pulsing";
import { reviewTools } from "./review";
import { spawnReviewTasksTool } from "./review/spawnReviewTasks";
import { submitSubReviewTool } from "./review/submitSubReview";
import type { RegisteredTool } from "./types";
import { registerTool } from "./types";
import { typescriptTools } from "./typescript";

/** All tools indexed by name */
export const toolRegistry: Record<string, RegisteredTool> = {};

// Register all tools
for (const tool of [
	...baseTools,
	...pulsingTools,
	...preflightTools,
	...reviewTools,
	...blockTools,
	...typescriptTools,
	...todoTools,
	...knowledgeTools,
]) {
	toolRegistry[tool.name] = tool;
}

// Register role-specific tools (not in shared reviewTools array)
toolRegistry[spawnReviewTasksTool.name] = registerTool(spawnReviewTasksTool);
toolRegistry[submitSubReviewTool.name] = registerTool(submitSubReviewTool);

/** Get a tool by name */
export function getTool(name: string): RegisteredTool | undefined {
	return toolRegistry[name];
}

/** Get all tool names */
export function getToolNames(): string[] {
	return Object.keys(toolRegistry);
}
