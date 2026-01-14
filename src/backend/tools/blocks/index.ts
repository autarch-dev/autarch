/**
 * Block tools - Structured output tools for stage completion
 *
 * These tools are used to submit artifacts for approval and transition
 * between workflow stages.
 */

export {
	type AskQuestionsInput,
	type AskQuestionsOutput,
	askQuestionsInputSchema,
	askQuestionsTool,
} from "./askQuestions";

export {
	type CompletePreflightInput,
	type CompletePreflightOutput,
	completePreflightInputSchema,
	completePreflightTool,
} from "./completePreflight";

export {
	type CompletePulseInput,
	type CompletePulseOutput,
	completePulseInputSchema,
	completePulseTool,
} from "./completePulse";

export {
	type RequestExtensionInput,
	type RequestExtensionOutput,
	requestExtensionInputSchema,
	requestExtensionTool,
} from "./requestExtension";

export {
	type SubmitPlanInput,
	type SubmitPlanOutput,
	submitPlanInputSchema,
	submitPlanTool,
} from "./submitPlan";

export {
	type SubmitResearchInput,
	type SubmitResearchOutput,
	submitResearchInputSchema,
	submitResearchTool,
} from "./submitResearch";

export {
	type SubmitScopeInput,
	type SubmitScopeOutput,
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
import { submitScopeTool } from "./submitScope";

export const blockTools = [
	registerTool(submitScopeTool),
	registerTool(submitResearchTool),
	registerTool(submitPlanTool),
	registerTool(requestExtensionTool),
	registerTool(askQuestionsTool),
	registerTool(completePulseTool),
	registerTool(completePreflightTool),
];
