/**
 * Typescript tools - TypeScript-specific tools
 */

export {
	type FindSymbolInput,
	findSymbolInputSchema,
	findSymbolTool,
} from "./find_symbol";
export {
	type GetSymbolInput,
	getSymbolInputSchema,
	getSymbolTool,
} from "./get_symbol";
export {
	type ListExportsInput,
	listExportsInputSchema,
	listExportsTool,
} from "./list_exports";

// Array of all typescript tools (registered for type-erased storage)
import { registerTool } from "../types";
import { findSymbolTool } from "./find_symbol";
import { getSymbolTool } from "./get_symbol";
import { listExportsTool } from "./list_exports";

export const typescriptTools = [
	registerTool(findSymbolTool),
	registerTool(getSymbolTool),
	registerTool(listExportsTool),
];
