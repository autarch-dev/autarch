/**
 * Pulsing tools - Code modification tools for the pulsing agent
 */

export {
	type EditFileInput,
	type EditFileOutput,
	editFileInputSchema,
	editFileTool,
} from "./editFile";

export {
	type MultiEditInput,
	type MultiEditOutput,
	multiEditInputSchema,
	multiEditTool,
} from "./multiEdit";

export {
	type ShellInput,
	type ShellOutput,
	shellInputSchema,
	shellTool,
} from "./shell";

export {
	type WriteFileInput,
	type WriteFileOutput,
	writeFileInputSchema,
	writeFileTool,
} from "./writeFile";

// Array of all pulsing tools (registered for type-erased storage)
import { registerTool } from "../types";
import { editFileTool } from "./editFile";
import { multiEditTool } from "./multiEdit";
import { shellTool } from "./shell";
import { writeFileTool } from "./writeFile";

export const pulsingTools = [
	registerTool(writeFileTool),
	registerTool(editFileTool),
	registerTool(multiEditTool),
	registerTool(shellTool),
];
