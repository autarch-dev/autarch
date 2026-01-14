/**
 * semantic_search - Search codebase by meaning using embeddings
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

export const semanticSearchInputSchema = z.object({
	reason: z.string().describe(REASON_DESCRIPTION),
	query: z.string().describe("The natural language search query"),
	patternWeights: z
		.array(z.string())
		.nullable()
		.optional()
		.describe(
			"Pattern weights as 'glob:weight' strings, e.g. ['**/*.cs:1.5', 'docs/**:0.1']. Weight >1 boosts, <1 penalizes, 0 excludes.",
		),
	maxResults: z
		.number()
		.int()
		.positive()
		.optional()
		.default(10)
		.describe("Maximum number of results to return (default: 10)"),
});

export type SemanticSearchInput = z.infer<typeof semanticSearchInputSchema>;

export interface SemanticSearchResult {
	file_path: string;
	start_line: number;
	end_line: number;
	snippet: string;
	score: number;
	adjusted_score?: number;
}

export type SemanticSearchOutput = SemanticSearchResult[];

// =============================================================================
// Tool Definition
// =============================================================================

export const semanticSearchTool: ToolDefinition<
	SemanticSearchInput,
	SemanticSearchOutput
> = {
	name: "semantic_search",
	description: `Search the codebase for files and code relevant to a query.
Returns ranked results with file paths, line numbers, and matched content snippets.

patternWeights adjusts result ranking by file path:
- Values >1 boost matches (e.g., 2.0 doubles score)
- Values <1 penalize matches (e.g., 0.1 reduces by 90%)
- Value 0 excludes matches entirely
- Use [] for no weighting

Common patterns: boost test files for test questions, deprioritize docs for code questions.`,
	inputSchema: semanticSearchInputSchema,
	execute: async (
		input,
		context,
	): Promise<ToolResult<SemanticSearchOutput>> => {
		// TODO: Implement semantic search using embedding index
		// - Query the embeddings database
		// - Apply pattern weights to adjust scores
		// - Return top matches with snippets

		return {
			success: false,
			error: "Project has not been indexed yet.",
		};
	},
};
