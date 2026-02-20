/**
 * semantic_search - Search codebase by meaning using embeddings
 */

import { z } from "zod";
import {
	getIndexingStatus,
	search,
} from "@/backend/services/embedding/indexer";
import type { SemanticSearchResult as EmbeddingSearchResult } from "@/shared/schemas/embedding";
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
	maxResults: z.coerce
		.number()
		.int()
		.positive()
		.optional()
		.default(10)
		.describe("Maximum number of results to return (default: 10)"),
});

export type SemanticSearchInput = z.infer<typeof semanticSearchInputSchema>;

// =============================================================================
// Pattern Weight Parsing
// =============================================================================

interface PatternWeight {
	glob: Bun.Glob;
	weight: number;
}

/**
 * Parse pattern weight strings into glob matchers.
 * Format: "glob:weight" e.g., "*.cs:1.5"
 */
function parsePatternWeights(patterns: string[]): PatternWeight[] {
	const result: PatternWeight[] = [];

	for (const pattern of patterns) {
		const lastColon = pattern.lastIndexOf(":");
		if (lastColon === -1) {
			continue; // Invalid format, skip
		}

		const globPattern = pattern.slice(0, lastColon);
		const weightStr = pattern.slice(lastColon + 1);
		const weight = parseFloat(weightStr);

		if (Number.isNaN(weight)) {
			continue; // Invalid weight, skip
		}

		try {
			const glob = new Bun.Glob(globPattern);
			result.push({ glob, weight });
		} catch {
			// Invalid glob pattern, skip
		}
	}

	return result;
}

/**
 * Calculate the weight multiplier for a file path.
 * Returns the first matching pattern's weight, or 1.0 if no match.
 */
function getWeightForPath(path: string, weights: PatternWeight[]): number {
	for (const { glob, weight } of weights) {
		if (glob.match(path)) {
			return weight;
		}
	}
	return 1.0; // No match, use default weight
}

interface SearchResult {
	filePath: string;
	startLine: number;
	endLine: number;
	snippet: string;
	score: number;
	adjustedScore?: number;
}

/**
 * Format search results as plain text
 */
function formatResults(results: SearchResult[]): string {
	if (results.length === 0) {
		return "No results found.";
	}

	const lines: string[] = [`Found ${results.length} result(s):\n`];

	for (const result of results) {
		lines.push(
			`--- ${result.filePath}:${result.startLine}-${result.endLine} ---`,
		);
		lines.push(result.snippet);
		lines.push("");
	}

	return lines.join("\n");
}

// =============================================================================
// Tool Definition
// =============================================================================

export const semanticSearchTool: ToolDefinition<SemanticSearchInput> = {
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
	execute: async (input, context): Promise<ToolResult> => {
		// Check if indexing is in progress
		const status = getIndexingStatus();
		if (status.isIndexing) {
			return {
				success: false,
				output:
					"Error: Project indexing is in progress. Please wait for it to complete.",
			};
		}

		// Parse pattern weights if provided
		const patternWeights = input.patternWeights
			? parsePatternWeights(input.patternWeights)
			: [];

		// Fetch more results than requested to account for filtering
		const fetchLimit =
			patternWeights.length > 0
				? (input.maxResults ?? 10) * 3
				: (input.maxResults ?? 10);

		// Perform semantic search
		let rawResults: EmbeddingSearchResult[];
		try {
			rawResults = await search(context.projectRoot, input.query, fetchLimit);
		} catch (err) {
			// Check if this is a "no indexed files" error
			if (err instanceof Error && err.message.includes("not been indexed")) {
				return {
					success: false,
					output:
						"Error: Project has not been indexed yet. Please run indexing first.",
				};
			}
			return {
				success: false,
				output: `Error: Semantic search failed: ${err instanceof Error ? err.message : "unknown error"}`,
			};
		}

		if (rawResults.length === 0) {
			return {
				success: true,
				output: "No results found.",
			};
		}

		// Apply pattern weights
		const weightedResults: SearchResult[] = rawResults.map((result) => {
			const weight = getWeightForPath(result.filePath, patternWeights);
			const adjustedScore = result.score * weight;

			return {
				filePath: result.filePath,
				startLine: result.startLine,
				endLine: result.endLine,
				snippet: result.snippet,
				score: result.score,
				adjustedScore: patternWeights.length > 0 ? adjustedScore : undefined,
			};
		});

		// Filter out excluded results (weight = 0)
		const filteredResults = weightedResults.filter(
			(r) => r.adjustedScore === undefined || r.adjustedScore > 0,
		);

		// Sort by adjusted score (or original score if no weights)
		filteredResults.sort((a, b) => {
			const scoreA = a.adjustedScore ?? a.score;
			const scoreB = b.adjustedScore ?? b.score;
			return scoreB - scoreA;
		});

		// Limit to requested number of results
		const limitedResults = filteredResults.slice(0, input.maxResults ?? 10);

		return {
			success: true,
			output: formatResults(limitedResults),
		};
	},
};
