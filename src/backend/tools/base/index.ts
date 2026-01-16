/**
 * Base tools - Available to all agents (read-only codebase access)
 */

export { type GrepInput, grepInputSchema, grepTool } from "./grep";

export {
	type ListDirectoryInput,
	listDirectoryInputSchema,
	listDirectoryTool,
} from "./listDirectory";

export {
	type ReadFileInput,
	readFileInputSchema,
	readFileTool,
} from "./readFile";

export {
	type SemanticSearchInput,
	semanticSearchInputSchema,
	semanticSearchTool,
} from "./semanticSearch";

export {
	type TakeNoteInput,
	takeNoteInputSchema,
	takeNoteTool,
} from "./takeNote";

export {
	type WebCodeSearchInput,
	webCodeSearchInputSchema,
	webCodeSearchTool,
} from "./webCodeSearch";

// Array of all base tools (registered for type-erased storage)
import { registerTool } from "../types";
import { grepTool } from "./grep";
import { listDirectoryTool } from "./listDirectory";
import { readFileTool } from "./readFile";
import { semanticSearchTool } from "./semanticSearch";
import { takeNoteTool } from "./takeNote";
import { webCodeSearchTool } from "./webCodeSearch";

export const baseTools = [
	registerTool(semanticSearchTool),
	registerTool(readFileTool),
	registerTool(listDirectoryTool),
	registerTool(grepTool),
	registerTool(takeNoteTool),
	registerTool(webCodeSearchTool),
];
