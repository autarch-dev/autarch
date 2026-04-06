import { registerTool } from "../types";

import {
	type SearchKnowledgeInput,
	searchKnowledgeInputSchema,
	searchKnowledgeTool,
} from "./searchKnowledge";

export {
	type SearchKnowledgeInput,
	searchKnowledgeInputSchema,
	searchKnowledgeTool,
};

export const knowledgeTools = [registerTool(searchKnowledgeTool)];
