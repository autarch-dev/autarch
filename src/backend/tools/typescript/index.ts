/**
 * Typescript tools - TypeScript-specific tools
 */

export {
	type FindSymbolInput,
	findSymbolInputSchema,
	findSymbolTool,
} from "./find_symbol";

// Array of all typescript tools (registered for type-erased storage)
import { registerTool } from "../types";
import { findSymbolTool } from "./find_symbol";

export const typescriptTools = [registerTool(findSymbolTool)];
