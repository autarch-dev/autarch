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
		constraints?: string[];
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
		constraints: card.constraints,
	}));

	return { sessionNotes, researchCards, reviewCards, scopeCards };
}

// =============================================================================
// LLM Extraction
// =============================================================================

const EXTRACTION_SYSTEM_PROMPT = `You are a knowledge extraction specialist. Your task is to analyze completed workflow data and extract ONLY knowledge that would be useful to a developer working on a future task in this codebase.

Apply this filter to every potential item: "If the specific task that produced this knowledge were already forgotten, would this item still be worth reading?" If not, discard it.

DO extract:
1. **Patterns**: Reusable code patterns, architectural approaches, naming conventions, or structural techniques observed in the codebase. Must include a concrete example.
2. **Gotchas**: Non-obvious pitfalls where the cause wasn't immediately apparent. Include the symptom, root cause, AND fix. Must pass this test: "If the fix were applied today, would this item still be worth reading tomorrow?" If yes, it's durable knowledge about the architecture. If no, it's a defect report — skip it.
3. **Tool Usage**: Discovered behaviors, flags, configurations, or integration techniques for specific tools/libraries/frameworks that are easy to get wrong.
4. **Process Insights**: Workflow or methodology discoveries — not that a process was followed, but that something was learned about the process.

DO NOT extract:
- Implementation plans or step-by-step instructions from research cards
- Descriptions of what code currently exists or how it's structured
- Recommendations that were written to guide this workflow's execution
- What the task/scope/goal was
- That a feature was implemented or a bug was fixed
- Bugs at specific file/line locations with straightforward fixes
- Missing parameter passing, inconsistent filter logic, UI state cleanup issues — these are code review findings, not knowledge
- Anything someone with experience in this codebase would already know

For research findings: the Summary, Dependencies, and Recommendations sections are implementation planning artifacts. Skip them. Only examine the Patterns section for extractable knowledge.

Each item must be self-contained, specific, and actionable in isolation. Include file paths, code snippets, or concrete examples where available.

Tags: lowercase, single words or hyphenated (e.g., "typescript", "error-handling", "api-design").

If nothing passes the filters, return an empty items array. An empty result is preferable to low-quality extractions.`;

/**
 * Build the extraction prompt from collected data.
 */
function buildExtractionPrompt(data: ExtractionData): string {
	const parts: string[] = [];

	// Research cards — only send patterns
	if (data.researchCards.length > 0) {
		const allPatterns = data.researchCards.flatMap(
			(card) => card.patterns ?? []
		);
		if (allPatterns.length > 0) {
			parts.push("## Codebase Patterns Observed");
			parts.push(
				"Evaluate each for durability beyond the immediate task:"
			);
			for (const pattern of allPatterns) {
				parts.push(
					`- [${pattern.category}] ${pattern.description}\n  Example: ${pattern.example}`
				);
			}
			parts.push("");
		}
	}

	// Review cards — filter to medium/high severity
	if (data.reviewCards.length > 0) {
		const actionableComments = data.reviewCards
			.flatMap((card) => card.comments)
			.filter((c) => c.severity === "high" || c.severity === "medium");
		if (actionableComments.length > 0) {
			parts.push("## Issues Encountered During Review");
			parts.push(
				"Extract only non-obvious architectural issues, not point-in-time defects:"
			);
			for (const comment of actionableComments) {
				const category = comment.category
					? `(${comment.category})`
					: "";
				parts.push(`- ${category} ${comment.description}`);
			}
			parts.push("");
		}
	}

	// Add session notes
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

	// Scope cards — last, labeled as background
	if (data.scopeCards.length > 0 && parts.length > 0) {
		parts.push("---");
		parts.push(
			"## Background (for context only — do not extract knowledge about the goals themselves)"
		);
		for (const scope of data.scopeCards) {
			parts.push(`**${scope.title}**: ${scope.description}`);
			if (scope.constraints && scope.constraints.length > 0) {
				parts.push("Architectural constraints:");
				for (const constraint of scope.constraints) {
					parts.push(`- ${constraint}`);
				}
			}
		}
		parts.push("");
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
