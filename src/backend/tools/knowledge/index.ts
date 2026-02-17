import { registerTool } from "../types";

import {
	type SearchKnowledgeInput,
	searchKnowledgeInputSchema,
	searchKnowledgeTool,
} from "./searchKnowledge";

export {
	searchKnowledgeInputSchema,
	searchKnowledgeTool,
	type SearchKnowledgeInput,
};

export const knowledgeTools = [registerTool(searchKnowledgeTool)];
