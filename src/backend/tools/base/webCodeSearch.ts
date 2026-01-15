/**
 * web_code_search - Search web for code examples using Exa Context API (Exa Code)
 *
 * Uses the Exa Context API which searches billions of GitHub repos, docs pages,
 * and Stack Overflow posts to find token-efficient code context for coding agents.
 *
 * This tool is conditionally available - it's filtered out if EXA_API_KEY is not set.
 */

import { z } from "zod";
import {
	REASON_DESCRIPTION,
	type ToolDefinition,
	type ToolResult,
} from "../types";

// =============================================================================
// Input Schema
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
// Exa Context API Response Schema
// =============================================================================

const ExaContextResponseSchema = z.object({
	requestId: z.string(),
	query: z.string(),
	response: z.string(),
	resultsCount: z.number(),
	costDollars: z.string(),
	searchTime: z.number(),
	outputTokens: z.number(),
});

// =============================================================================
// Tool Definition
// =============================================================================

export const webCodeSearchTool: ToolDefinition<
	WebCodeSearchInput,
	WebCodeSearchOutput
> = {
	name: "web_code_search",
	description: `Search and get relevant code context using Exa Code API.
Searches billions of GitHub repos, docs pages, and Stack Overflow posts.
Returns token-efficient code snippets and examples.

Use this tool for:
- Framework usage patterns
- API syntax examples  
- Library implementation examples
- Development setup and configuration
- Best practices and patterns`,
	inputSchema: webCodeSearchInputSchema,
	execute: async (
		input,
		_context,
	): Promise<ToolResult<WebCodeSearchOutput>> => {
		// Get API key from environment (tool is filtered if not set, but check anyway)
		const apiKey = process.env.EXA_API_KEY;
		if (!apiKey) {
			return {
				success: false,
				error: "EXA_API_KEY environment variable is not set",
			};
		}

		// Call Exa Context API (Exa Code)
		try {
			const response = await fetch("https://api.exa.ai/context", {
				method: "POST",
				headers: {
					"x-api-key": apiKey,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					query: input.query,
					tokensNum: 5000, // Good default for most queries
				}),
			});

			if (!response.ok) {
				const errorText = await response.text().catch(() => "Unknown error");
				return {
					success: false,
					error: `Exa Context API error (${response.status}): ${errorText}`,
				};
			}

			const json: unknown = await response.json();
			const parseResult = ExaContextResponseSchema.safeParse(json);

			if (!parseResult.success) {
				return {
					success: false,
					error: `Invalid response from Exa API: ${parseResult.error.message}`,
				};
			}

			const data = parseResult.data;

			if (!data.response) {
				return {
					success: true,
					data: "No code context found for the query.",
				};
			}

			return {
				success: true,
				data: data.response,
			};
		} catch (err) {
			return {
				success: false,
				error: `Exa API error: ${err instanceof Error ? err.message : "unknown error"}`,
			};
		}
	},
};
