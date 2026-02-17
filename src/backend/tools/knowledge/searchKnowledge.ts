import { z } from "zod";

import { searchKnowledge } from "../../services/knowledge/search";
import type { ToolDefinition } from "../types";
import { REASON_DESCRIPTION } from "../types";

export const knowledgeCategorySchema = z.enum([
	"pattern",
	"gotcha",
	"tool-usage",
	"process-improvement",
]);

export const searchKnowledgeInputSchema = z.object({
	reason: z.string().describe(REASON_DESCRIPTION),
	query: z.string().min(1),
	category: knowledgeCategorySchema.optional(),
	tags: z.array(z.string().min(1)).optional(),
	limit: z.number().int().positive().default(10),
});

export type SearchKnowledgeInput = z.infer<typeof searchKnowledgeInputSchema>;

function truncate(text: string, maxLength: number): string {
	if (text.length <= maxLength) return text;
	return `${text.slice(0, maxLength - 1)}…`;
}

function formatSimilarity(similarity: number | undefined): string {
	if (similarity === undefined || Number.isNaN(similarity)) return "n/a";
	return similarity.toFixed(2);
}

export const searchKnowledgeTool: ToolDefinition<SearchKnowledgeInput> = {
	name: "search_knowledge",
	description:
		"Search the project knowledge base for patterns, gotchas, tool usage, or process improvements.",
	inputSchema: searchKnowledgeInputSchema,
	execute: async (input, context) => {
		try {
			const filters = {
				category: input.category,
				tags: input.tags,
				limit: input.limit,
			};

			const results = await searchKnowledge(
				input.query,
				filters,
				context.projectRoot,
			);

			if (results.length === 0) {
				return {
					success: true,
					output: "No knowledge items found matching your query.",
				};
			}

			const output = results
				.map((result, index) => {
					const titleLine = `${index + 1}. ${result.title}`;
					const categoryLine = `Category: ${result.category}`;
					const tagsLine = `Tags: ${result.tags.length ? result.tags.join(", ") : "none"}`;
					const similarityLine = `Similarity: ${formatSimilarity(result.similarity)}`;
					const contentLine = `Content: ${truncate(result.content.replace(/\s+/g, " ").trim(), 500)}`;
					const provenanceLine = `Provenance: workflowId=${result.workflowId}, cardId=${result.cardId}`;

					return [
						titleLine,
						categoryLine,
						tagsLine,
						similarityLine,
						contentLine,
						provenanceLine,
					].join("\n");
				})
				.join("\n\n");

			return {
				success: true,
				output,
			};
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: "Unknown error while searching knowledge.";

			return {
				success: false,
				output: `Knowledge search failed: ${message}`,
			};
		}
	},
};
