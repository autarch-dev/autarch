/**
 * KnowledgeRepository - Data access for knowledge items
 *
 * Handles CRUD operations for knowledge items and their embeddings.
 * Knowledge items are extracted from completed workflows and provide
 * fine-grained insights with full provenance traceability.
 */

import type { Kysely } from "kysely";
import type {
	InsertableKnowledgeEmbedding,
	InsertableKnowledgeItem,
	KnowledgeCategory,
	KnowledgeDatabase,
	KnowledgeItemsTable,
} from "@/backend/db/knowledge/types";
import { ids } from "@/backend/utils";

// =============================================================================
// Domain Types
// =============================================================================

/**
 * Domain model for a knowledge item.
 * Unlike the database row, tags is a string[] instead of JSON string.
 */
export interface KnowledgeItem {
	id: string;
	workflowId: string;
	cardId: string | null;
	sessionId: string | null;
	turnId: string | null;
	title: string;
	content: string;
	category: KnowledgeCategory;
	tags: string[];
	createdAt: number;
}

/**
 * Data required to create a new knowledge item.
 */
export interface CreateKnowledgeItemData {
	workflowId: string;
	cardId?: string | null;
	sessionId?: string | null;
	turnId?: string | null;
	title: string;
	content: string;
	category: KnowledgeCategory;
	tags: string[];
}

/**
 * Filters for searching knowledge items.
 */
export interface KnowledgeSearchFilters {
	category?: KnowledgeCategory;
	workflowId?: string;
	startDate?: number;
	endDate?: number;
	tags?: string[];
}

// =============================================================================
// Domain Mapping Functions
// =============================================================================

/**
 * Convert a database row to a domain KnowledgeItem.
 * Parses tags_json from TEXT to string[].
 */
export function toKnowledgeItem(row: KnowledgeItemsTable): KnowledgeItem {
	let tags: string[] = [];
	try {
		const parsed = JSON.parse(row.tags_json);
		if (Array.isArray(parsed)) {
			tags = parsed;
		}
	} catch {
		// If parsing fails, default to empty array
		tags = [];
	}

	return {
		id: row.id,
		workflowId: row.workflow_id,
		cardId: row.card_id,
		sessionId: row.session_id,
		turnId: row.turn_id,
		title: row.title,
		content: row.content,
		category: row.category,
		tags,
		createdAt: row.created_at,
	};
}

/**
 * Convert domain data to an insertable database row.
 * Stringifies tags to JSON.
 */
export function toKnowledgeItemRow(
	data: CreateKnowledgeItemData,
): Omit<InsertableKnowledgeItem, "id" | "created_at"> {
	return {
		workflow_id: data.workflowId,
		card_id: data.cardId ?? null,
		session_id: data.sessionId ?? null,
		turn_id: data.turnId ?? null,
		title: data.title,
		content: data.content,
		category: data.category,
		tags_json: JSON.stringify(data.tags),
	};
}

// =============================================================================
// Repository
// =============================================================================

export class KnowledgeRepository {
	constructor(readonly db: Kysely<KnowledgeDatabase>) {}

	/**
	 * Create a new knowledge item.
	 * Returns the generated ID.
	 */
	async create(item: CreateKnowledgeItemData): Promise<string> {
		const id = ids.knowledge();
		const now = Date.now();
		const row = toKnowledgeItemRow(item);

		await this.db
			.insertInto("knowledge_items")
			.values({
				id,
				...row,
				created_at: now,
			})
			.execute();

		return id;
	}

	/**
	 * Create a knowledge item with its embedding in a transaction.
	 * Returns the generated ID.
	 */
	async createWithEmbedding(
		item: CreateKnowledgeItemData,
		embedding: Buffer,
	): Promise<string> {
		const id = ids.knowledge();
		const now = Date.now();
		const row = toKnowledgeItemRow(item);

		await this.db.transaction().execute(async (trx) => {
			// Insert knowledge item
			await trx
				.insertInto("knowledge_items")
				.values({
					id,
					...row,
					created_at: now,
				})
				.execute();

			// Insert embedding
			const embeddingRow: InsertableKnowledgeEmbedding = {
				id,
				embedding: new Uint8Array(embedding),
				created_at: now,
			};

			await trx
				.insertInto("knowledge_embeddings")
				.values(embeddingRow)
				.execute();
		});

		return id;
	}

	/**
	 * Get a knowledge item by ID.
	 * Returns null if not found.
	 */
	async getById(id: string): Promise<KnowledgeItem | null> {
		const row = await this.db
			.selectFrom("knowledge_items")
			.selectAll()
			.where("id", "=", id)
			.executeTakeFirst();

		return row ? toKnowledgeItem(row) : null;
	}

	/**
	 * Get all knowledge items for a workflow.
	 * Returns items ordered by created_at desc.
	 */
	async getByWorkflowId(workflowId: string): Promise<KnowledgeItem[]> {
		const rows = await this.db
			.selectFrom("knowledge_items")
			.selectAll()
			.where("workflow_id", "=", workflowId)
			.orderBy("created_at", "desc")
			.execute();

		return rows.map(toKnowledgeItem);
	}

	/**
	 * Search knowledge items with optional filters.
	 * Returns items ordered by created_at desc.
	 */
	async search(filters: KnowledgeSearchFilters): Promise<KnowledgeItem[]> {
		let query = this.db.selectFrom("knowledge_items").selectAll();

		if (filters.category !== undefined) {
			query = query.where("category", "=", filters.category);
		}

		if (filters.workflowId !== undefined) {
			query = query.where("workflow_id", "=", filters.workflowId);
		}

		if (filters.startDate !== undefined) {
			query = query.where("created_at", ">=", filters.startDate);
		}

		if (filters.endDate !== undefined) {
			query = query.where("created_at", "<=", filters.endDate);
		}

		// Tag filtering: check if any of the requested tags are present in the JSON array
		// Using SQLite's LIKE for simple tag matching within the JSON string
		if (filters.tags !== undefined && filters.tags.length > 0) {
			for (const tag of filters.tags) {
				// Escape special characters in tag for LIKE pattern
				const escapedTag = tag.replace(/[%_\\]/g, "\\$&");
				query = query.where("tags_json", "like", `%"${escapedTag}"%`);
			}
		}

		const rows = await query.orderBy("created_at", "desc").execute();

		return rows.map(toKnowledgeItem);
	}
}
