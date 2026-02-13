/**
 * Knowledge Search Service
 *
 * Provides semantic search over knowledge items using vector embeddings
 * and structured filtering. Computes cosine similarity in JavaScript
 * for similarity-based retrieval.
 */

import { getKnowledgeDb } from "@/backend/db/knowledge";
import type { KnowledgeCategory } from "@/backend/db/knowledge/types";
import { log } from "@/backend/logger";
import { embed } from "@/backend/services/embedding/provider";
import { type KnowledgeItem, KnowledgeRepository } from "./repository";

// =============================================================================
// Types
// =============================================================================

/**
 * Filters for searching knowledge items.
 */
export interface SearchFilters {
	category?: KnowledgeCategory;
	workflowId?: string;
	startDate?: number;
	endDate?: number;
	tags?: string[];
	limit?: number;
	archived?: boolean;
}

/**
 * A knowledge item with its similarity score from semantic search.
 */
export interface KnowledgeSearchResult extends KnowledgeItem {
	similarity: number;
}

// =============================================================================
// Constants
// =============================================================================

/** Default number of results to return */
const DEFAULT_LIMIT = 20;

/** Minimum similarity threshold to filter noise */
const SIMILARITY_THRESHOLD = 0.5;

// =============================================================================
// Vector Similarity
// =============================================================================

/**
 * Compute cosine similarity between two vectors.
 * Returns a value between -1 and 1, where 1 means identical direction.
 */
function cosineSimilarity(a: Float32Array, b: Float32Array): number {
	let dot = 0;
	let normA = 0;
	let normB = 0;
	// Both arrays have the same length (768 dimensions)
	for (const [i, ai] of a.entries()) {
		const bi = b[i] ?? 0;
		dot += ai * bi;
		normA += ai * ai;
		normB += bi * bi;
	}
	return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Convert a BLOB (Buffer/Uint8Array) back to Float32Array.
 */
function blobToFloat32Array(blob: Buffer | Uint8Array): Float32Array {
	return new Float32Array(blob.buffer, blob.byteOffset, blob.byteLength / 4);
}

// =============================================================================
// Search Implementation
// =============================================================================

/**
 * Search knowledge items with semantic search and structured filters.
 *
 * Function flow:
 * 1. If query is empty: use repository.search(filters) for structured-only search
 * 2. If query present:
 *    - Generate query embedding via embed()
 *    - Load all embeddings from knowledge_embeddings table
 *    - Compute cosine similarity in JavaScript for each embedding against query embedding
 *    - Sort by similarity desc
 *    - Apply structured filters to results
 *    - Return top N items with similarity scores
 *
 * @param query - The search query text (empty string for structured-only search)
 * @param filters - Structured filters to apply
 * @param projectRoot - The project root directory
 * @returns Array of knowledge items with similarity scores, sorted by relevance
 */
export async function searchKnowledge(
	query: string,
	filters: SearchFilters,
	projectRoot: string,
): Promise<KnowledgeSearchResult[]> {
	const limit = filters.limit ?? DEFAULT_LIMIT;
	const knowledgeDb = await getKnowledgeDb(projectRoot);
	const knowledgeRepo = new KnowledgeRepository(knowledgeDb);

	// If query is empty, use structured-only search
	if (!query.trim()) {
		log.knowledge.debug("Performing structured-only search (no query)");
		const items = await knowledgeRepo.search({
			category: filters.category,
			workflowId: filters.workflowId,
			startDate: filters.startDate,
			endDate: filters.endDate,
			tags: filters.tags,
		});

		// Filter by archived status: if explicitly true, keep only archived;
		// otherwise exclude archived items by default
		let filteredItems = items;
		if (filters.archived === true) {
			filteredItems = filteredItems.filter((item) => item.archived === true);
		} else {
			filteredItems = filteredItems.filter((item) => item.archived !== true);
		}

		// Return items with similarity of 1.0 (perfect match for structured search)
		return filteredItems.slice(0, limit).map((item) => ({
			...item,
			similarity: 1.0,
		}));
	}

	// Semantic search with query
	log.knowledge.debug(`Performing semantic search for: "${query}"`);

	// Generate query embedding
	const queryEmbedding = await embed(query);

	// Fetch all embeddings with their IDs
	const allEmbeddings = await knowledgeDb
		.selectFrom("knowledge_embeddings")
		.select(["id", "embedding"])
		.execute();

	if (allEmbeddings.length === 0) {
		log.knowledge.debug("No embeddings found in knowledge database");
		return [];
	}

	// Compute similarity scores for all embeddings
	const similarities: Array<{ id: string; similarity: number }> = [];
	for (const row of allEmbeddings) {
		const embedding = blobToFloat32Array(row.embedding as Buffer);
		const similarity = cosineSimilarity(queryEmbedding, embedding);

		// Only include results above the similarity threshold
		if (similarity > SIMILARITY_THRESHOLD) {
			similarities.push({ id: row.id, similarity });
		}
	}

	// Sort by similarity descending
	similarities.sort((a, b) => b.similarity - a.similarity);

	log.knowledge.debug(
		`Found ${similarities.length} items above similarity threshold ${SIMILARITY_THRESHOLD}`,
	);

	// Create a map of ID to similarity score for quick lookup
	const similarityMap = new Map(similarities.map((s) => [s.id, s.similarity]));

	// Fetch the knowledge items for top candidates
	// We fetch more than limit to allow for filtering
	const candidateIds = similarities.slice(0, limit * 2).map((s) => s.id);

	if (candidateIds.length === 0) {
		return [];
	}

	// Fetch items from database
	const items: KnowledgeItem[] = [];
	for (const id of candidateIds) {
		const item = await knowledgeRepo.getById(id);
		if (item) {
			items.push(item);
		}
	}

	// Apply structured filters to the results
	let filteredItems = items;

	if (filters.category !== undefined) {
		filteredItems = filteredItems.filter(
			(item) => item.category === filters.category,
		);
	}

	if (filters.workflowId !== undefined) {
		filteredItems = filteredItems.filter(
			(item) => item.workflowId === filters.workflowId,
		);
	}

	if (filters.startDate !== undefined) {
		const startDate = filters.startDate;
		filteredItems = filteredItems.filter((item) => item.createdAt >= startDate);
	}

	if (filters.endDate !== undefined) {
		const endDate = filters.endDate;
		filteredItems = filteredItems.filter((item) => item.createdAt <= endDate);
	}

	if (filters.tags !== undefined && filters.tags.length > 0) {
		// All requested tags must be present
		const filterTags = filters.tags;
		filteredItems = filteredItems.filter((item) =>
			filterTags.every((tag) => item.tags.includes(tag)),
		);
	}

	// Filter by archived status: if explicitly true, keep only archived;
	// otherwise exclude archived items by default
	if (filters.archived === true) {
		filteredItems = filteredItems.filter((item) => item.archived === true);
	} else {
		filteredItems = filteredItems.filter((item) => item.archived !== true);
	}

	// Map to results with similarity scores
	const results: KnowledgeSearchResult[] = filteredItems.map((item) => ({
		...item,
		similarity: similarityMap.get(item.id) ?? 0,
	}));

	// Sort by similarity (should already be sorted, but ensure after filtering)
	results.sort((a, b) => b.similarity - a.similarity);

	// Return top N results
	return results.slice(0, limit);
}
