/**
 * web_code_search - Search web for code examples and documentation
 */

import { z } from "zod";
import {
	REASON_DESCRIPTION,
	type ToolDefinition,
	type ToolResult,
} from "../types";

// =============================================================================
// Schema
// =============================================================================

export const webCodeSearchInputSchema = z.object({
	reason: z.string().describe(REASON_DESCRIPTION),
	query: z
		.string()
		.describe(
			"A short query describing the code or documentation to search for, e.g. 'authentication patterns in NextJS applications'",
		),
});

export type WebCodeSearchInput = z.infer<typeof webCodeSearchInputSchema>;

export type WebCodeSearchOutput = string;

// =============================================================================
// Tool Definition
// =============================================================================

export const webCodeSearchTool: ToolDefinition<
	WebCodeSearchInput,
	WebCodeSearchOutput
> = {
	name: "web_code_search",
	description: `Search and get relevant context for any programming task using Exa Code API
Provides the highest quality and freshest context for libraries, SDKs, and APIs
Use this tool for ANY question or task related to programming
Returns comprehensive code examples, documentation, and API references
Optimized for finding specific programming patterns and solutions`,
	inputSchema: webCodeSearchInputSchema,
	execute: async (input, context): Promise<ToolResult<WebCodeSearchOutput>> => {
		// TODO: Implement Exa Code API integration
		// - Call Exa API with query
		// - Format and return results

		return {
			success: false,
			error: `There was an error searching the web for code: API not configured`,
		};
	},
};
