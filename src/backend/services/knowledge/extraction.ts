/**
 * Knowledge Extraction Service
 *
 * Extracts fine-grained knowledge items from completed workflows using LLM analysis.
 * Analyzes session notes, research cards, and review cards to identify patterns,
 * gotchas, tool learnings, and process insights.
 */

import { generateObject } from "ai";
import { z } from "zod";
import { getKnowledgeDb } from "@/backend/db/knowledge";
import type { KnowledgeCategory } from "@/backend/db/knowledge/types";
import { getProjectDb } from "@/backend/db/project";
import { getModelForScenario } from "@/backend/llm/models";
import { log } from "@/backend/logger";
import { ArtifactRepository } from "@/backend/repositories/ArtifactRepository";
import { ConversationRepository } from "@/backend/repositories/ConversationRepository";
import { SessionRepository } from "@/backend/repositories/SessionRepository";
import { embedBatch } from "@/backend/services/embedding/provider";
import { broadcast } from "@/backend/ws";
import {
	createKnowledgeExtractionCompletedEvent,
	createKnowledgeExtractionFailedEvent,
	createKnowledgeExtractionStartedEvent,
} from "@/shared/schemas/events";
import { KnowledgeRepository } from "./repository";

// =============================================================================
// Zod Schema for LLM Extraction
// =============================================================================

const KnowledgeCategorySchema = z.enum([
	"pattern",
	"gotcha",
	"tool-usage",
	"process-improvement",
]);

const KnowledgeItemSchema = z.object({
	title: z
		.string()
		.describe("Brief, descriptive title for the knowledge item (2-8 words)"),
	content: z
		.string()
		.describe(
			"Detailed description of the knowledge item. Include specific examples, file paths, or code patterns where applicable.",
		),
	category: KnowledgeCategorySchema.describe(
		"Category: pattern (reusable code patterns), gotcha (pitfalls to avoid), tool-usage (tool tips), process-improvement (workflow insights)",
	),
	tags: z
		.array(z.string())
		.describe(
			"Relevant tags for filtering (e.g., typescript, testing, database, api, error-handling)",
		),
});

const ExtractionResultSchema = z.object({
	items: z
		.array(KnowledgeItemSchema)
		.describe("Array of extracted knowledge items"),
});

type ExtractionResult = z.infer<typeof ExtractionResultSchema>;

// =============================================================================
// Data Collection
// =============================================================================

interface ExtractionData {
	sessionNotes: { id: string; content: string; createdAt: number }[];
	researchCards: {
		id: string;
		summary: string;
		patterns?: { category: string; description: string; example: string }[];
		recommendations: string[];
	}[];
	reviewCards: {
		id: string;
		comments: { description: string; category?: string; severity?: string }[];
	}[];
	scopeCards: {
		id: string;
		title: string;
		description: string;
	}[];
}

/**
 * Collect all relevant data from a workflow for knowledge extraction.
 */
async function collectExtractionData(
	workflowId: string,
	projectRoot: string,
): Promise<ExtractionData> {
	const projectDb = await getProjectDb(projectRoot);
	const sessionRepo = new SessionRepository(projectDb);
	const conversationRepo = new ConversationRepository(projectDb);
	const artifactRepo = new ArtifactRepository(projectDb);

	// Load all sessions for this workflow
	const sessions = await sessionRepo.getByContext("workflow", workflowId);

	// Load session notes from all sessions
	const sessionNotes: ExtractionData["sessionNotes"] = [];
	for (const session of sessions) {
		const notes = await conversationRepo.getNotes(
			"workflow",
			workflowId,
			session.id,
		);
		sessionNotes.push(...notes);
	}

	// Load research cards
	const allResearchCards = await artifactRepo.getAllResearchCards(workflowId);
	const researchCards = allResearchCards.map((card) => ({
		id: card.id,
		summary: card.summary,
		patterns: card.patterns?.map((p) => ({
			category: p.category,
			description: p.description,
			example: p.example,
		})),
		recommendations: card.recommendations,
	}));

	// Load review cards with comments
	const allReviewCards = await artifactRepo.getAllReviewCards(workflowId);
	const reviewCards = allReviewCards.map((card) => ({
		id: card.id,
		comments:
			card.comments?.map((c) => ({
				description: c.description,
				category: c.category,
				severity: c.severity,
			})) ?? [],
	}));

	// Load scope cards for context
	const allScopeCards = await artifactRepo.getAllScopeCards(workflowId);
	const scopeCards = allScopeCards.map((card) => ({
		id: card.id,
		title: card.title,
		description: card.description,
	}));

	return { sessionNotes, researchCards, reviewCards, scopeCards };
}

// =============================================================================
// LLM Extraction
// =============================================================================

const EXTRACTION_SYSTEM_PROMPT = `You are a knowledge extraction specialist. Your task is to analyze completed workflow data and extract fine-grained, actionable knowledge items.

Focus on extracting:
1. **Patterns**: Reusable code patterns, architectural decisions, naming conventions, or structural approaches that proved effective.
2. **Gotchas**: Pitfalls, edge cases, or issues encountered that others should avoid. Include the problem AND the solution/workaround.
3. **Tool Usage**: Tips for using specific tools, libraries, or frameworks effectively. Include concrete examples.
4. **Process Improvements**: Insights about the development process, workflow optimizations, or methodology learnings.

Guidelines:
- Be specific and actionable - include file paths, code snippets, or concrete examples where available
- Each item should be self-contained and useful in isolation
- Prefer multiple small, focused items over large, general ones
- Skip trivial or obvious information
- Tags should be lowercase, single words or hyphenated (e.g., "typescript", "error-handling", "api-design")
- If the data contains no notable insights, return an empty items array`;

/**
 * Build the extraction prompt from collected data.
 */
function buildExtractionPrompt(data: ExtractionData): string {
	const parts: string[] = [];

	// Add scope context
	if (data.scopeCards.length > 0) {
		parts.push("## Workflow Context");
		for (const scope of data.scopeCards) {
			parts.push(`**${scope.title}**: ${scope.description}`);
		}
		parts.push("");
	}

	// Add session notes (highest priority source)
	if (data.sessionNotes.length > 0) {
		parts.push("## Session Notes");
		parts.push(
			"These are notes captured during agent sessions - rich source of insights:",
		);
		for (const note of data.sessionNotes) {
			parts.push(`- ${note.content}`);
		}
		parts.push("");
	}

	// Add research patterns
	if (data.researchCards.length > 0) {
		parts.push("## Research Findings");
		for (const card of data.researchCards) {
			parts.push(`**Summary**: ${card.summary}`);
			if (card.patterns && card.patterns.length > 0) {
				parts.push("**Patterns identified**:");
				for (const pattern of card.patterns) {
					parts.push(
						`- [${pattern.category}] ${pattern.description}\n  Example: ${pattern.example}`,
					);
				}
			}
			if (card.recommendations.length > 0) {
				parts.push("**Recommendations**:");
				for (const rec of card.recommendations) {
					parts.push(`- ${rec}`);
				}
			}
			parts.push("");
		}
	}

	// Add review comments (gotchas source)
	if (data.reviewCards.length > 0) {
		const allComments = data.reviewCards.flatMap((card) => card.comments);
		if (allComments.length > 0) {
			parts.push("## Review Comments");
			parts.push("Issues and observations from code review:");
			for (const comment of allComments) {
				const severity = comment.severity ? `[${comment.severity}]` : "";
				const category = comment.category ? `(${comment.category})` : "";
				parts.push(`- ${severity}${category} ${comment.description}`);
			}
			parts.push("");
		}
	}

	if (parts.length === 0) {
		return "No workflow data available for extraction.";
	}

	return parts.join("\n");
}

/**
 * Extract knowledge items using LLM analysis.
 * Returns empty array on failure (does not throw).
 */
async function extractKnowledgeItems(
	data: ExtractionData,
): Promise<ExtractionResult["items"]> {
	const prompt = buildExtractionPrompt(data);

	// Skip extraction if there's no meaningful data
	if (
		data.sessionNotes.length === 0 &&
		data.researchCards.length === 0 &&
		data.reviewCards.length === 0
	) {
		log.knowledge.debug("No data available for extraction, skipping LLM call");
		return [];
	}

	try {
		const { model } = await getModelForScenario("basic");

		const { object } = await generateObject({
			model,
			schema: ExtractionResultSchema,
			system: EXTRACTION_SYSTEM_PROMPT,
			prompt,
		});

		return object.items;
	} catch (error) {
		log.knowledge.error("LLM extraction failed:", error);
		return [];
	}
}

// =============================================================================
// Main Entry Point
// =============================================================================

/**
 * Extract knowledge from a completed workflow.
 *
 * Function flow:
 * 1. Get project DB and knowledge DB connections
 * 2. Load all sessions via SessionRepository.getByContext('workflow', workflowId)
 * 3. For each session: load session_notes via ConversationRepository.getNotes()
 * 4. Load artifacts via ArtifactRepository: research_cards, review_cards, scope_cards
 * 5. Call extractKnowledgeItems(data) with LLM extraction
 * 6. Store items and embeddings
 * 7. Return count
 *
 * @param workflowId - The workflow ID to extract knowledge from
 * @param projectRoot - The project root directory
 * @returns Number of knowledge items extracted and stored
 */
export async function extractKnowledge(
	workflowId: string,
	projectRoot: string,
): Promise<number> {
	log.knowledge.info(
		`Starting knowledge extraction for workflow ${workflowId}`,
	);
	broadcast(createKnowledgeExtractionStartedEvent({ workflowId }));

	try {
		// 1. Get database connections
		const knowledgeDb = await getKnowledgeDb(projectRoot);
		const knowledgeRepo = new KnowledgeRepository(knowledgeDb);

		// 2-4. Collect all extraction data
		const data = await collectExtractionData(workflowId, projectRoot);
		log.knowledge.debug(
			`Collected data: ${data.sessionNotes.length} notes, ${data.researchCards.length} research cards, ${data.reviewCards.length} review cards`,
		);

		// 5. Extract knowledge items using LLM
		const items = await extractKnowledgeItems(data);
		log.knowledge.debug(`Extracted ${items.length} knowledge items`);

		// 6. Generate embeddings for all items in batch
		const embeddingTexts = items.map(
			(item) => `${item.title}\n\n${item.content}`,
		);

		let embeddings: (Float32Array | null)[] = [];
		if (items.length > 0) {
			try {
				const embeddingResults = await embedBatch(embeddingTexts);
				embeddings = embeddingResults;
			} catch (error) {
				// Batch embedding failed - log warning and store all items without embeddings
				log.knowledge.warn(
					"Embedding batch generation failed, storing items without embeddings:",
					error,
				);
				embeddings = items.map(() => null);
			}
		}

		// 7. Store items with embeddings in transaction
		let storedCount = 0;
		for (let i = 0; i < items.length; i++) {
			const item = items[i];
			const embedding = embeddings[i];

			// Safety guard (shouldn't happen in practice)
			if (!item) {
				continue;
			}

			try {
				const itemData = {
					workflowId,
					title: item.title,
					content: item.content,
					category: item.category as KnowledgeCategory,
					tags: item.tags,
				};

				if (embedding) {
					// Store with embedding
					const embeddingBuffer = Buffer.from(embedding.buffer);
					await knowledgeRepo.createWithEmbedding(itemData, embeddingBuffer);
				} else {
					// Embedding generation failed for this item - store without embedding
					log.knowledge.warn(
						`Storing knowledge item without embedding: id=${i}, title="${item.title}"`,
					);
					await knowledgeRepo.create(itemData);
				}
				storedCount++;
			} catch (error) {
				// Log individual item storage failures but continue processing
				log.knowledge.warn(
					`Failed to store knowledge item "${item.title}":`,
					error,
				);
			}
		}

		// 8. Return count
		log.knowledge.success(
			`Knowledge extraction completed: ${storedCount} items stored for workflow ${workflowId}`,
		);
		broadcast(
			createKnowledgeExtractionCompletedEvent({
				workflowId,
				itemCount: storedCount,
			}),
		);

		return storedCount;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		log.knowledge.error(
			`Knowledge extraction failed for workflow ${workflowId}:`,
			error,
		);
		broadcast(
			createKnowledgeExtractionFailedEvent({
				workflowId,
				error: errorMessage,
			}),
		);
		throw error;
	}
}
