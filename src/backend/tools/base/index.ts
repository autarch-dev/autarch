/**
 * Base tools - Available to all agents (read-only codebase access)
 */

export {
	type GrepInput,
	type GrepOutput,
	grepInputSchema,
	grepTool,
} from "./grep";

export {
	type ListDirectoryInput,
	type ListDirectoryOutput,
	listDirectoryInputSchema,
	listDirectoryTool,
} from "./listDirectory";

export {
	type ReadFileInput,
	type ReadFileOutput,
	readFileInputSchema,
	readFileTool,
} from "./readFile";

export {
	type SemanticSearchInput,
	type SemanticSearchOutput,
	type SemanticSearchResult,
	semanticSearchInputSchema,
	semanticSearchTool,
} from "./semanticSearch";

export {
	type TakeNoteInput,
	type TakeNoteOutput,
	takeNoteInputSchema,
	takeNoteTool,
} from "./takeNote";

export {
	type WebCodeSearchInput,
	type WebCodeSearchOutput,
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
