/**
 * Block tools - Structured output tools for stage completion
 *
 * These tools are used to submit artifacts for approval and transition
 * between workflow stages.
 */

export {
	type AskQuestionsInput,
	askQuestionsInputSchema,
	askQuestionsTool,
} from "./askQuestions";

export {
	type CompletePreflightInput,
	completePreflightInputSchema,
	completePreflightTool,
} from "./completePreflight";

export {
	type CompletePulseInput,
	completePulseInputSchema,
	completePulseTool,
} from "./completePulse";

export {
	type RequestExtensionInput,
	requestExtensionInputSchema,
	requestExtensionTool,
} from "./requestExtension";

export {
	type SubmitPlanInput,
	submitPlanInputSchema,
	submitPlanTool,
} from "./submitPlan";

export {
	type SubmitResearchInput,
	submitResearchInputSchema,
	submitResearchTool,
} from "./submitResearch";

export {
	type SubmitRoadmapInput,
	submitRoadmapInputSchema,
	submitRoadmapTool,
} from "./submitRoadmap";

export {
	type SubmitScopeInput,
	submitScopeInputSchema,
	submitScopeTool,
} from "./submitScope";

// Array of all block tools (registered for type-erased storage)
import { registerTool } from "../types";
import { askQuestionsTool } from "./askQuestions";
import { completePreflightTool } from "./completePreflight";
import { completePulseTool } from "./completePulse";
import { requestExtensionTool } from "./requestExtension";
import { submitPlanTool } from "./submitPlan";
import { submitResearchTool } from "./submitResearch";
import { submitRoadmapTool } from "./submitRoadmap";
import { submitScopeTool } from "./submitScope";

export const blockTools = [
	registerTool(submitScopeTool),
	registerTool(submitRoadmapTool),
	registerTool(submitResearchTool),
	registerTool(submitPlanTool),
	registerTool(requestExtensionTool),
	registerTool(askQuestionsTool),
	registerTool(completePulseTool),
	registerTool(completePreflightTool),
];
