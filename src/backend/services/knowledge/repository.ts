/**
 * KnowledgeRepository - Data access for knowledge items
 *
 * Handles CRUD operations for knowledge items and their embeddings.
 * Knowledge items are extracted from completed workflows and provide
 * fine-grained insights with full provenance traceability.
 */

import type { Kysely, SelectQueryBuilder } from "kysely";
import type {
	InsertableKnowledgeEmbedding,
	InsertableKnowledgeItem,
	KnowledgeCategory,
	KnowledgeDatabase,
	KnowledgeItemsTable,
	UpdateableKnowledgeItem,
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
	archived: boolean;
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
	archived?: boolean;
}

/**
 * Filters for searching knowledge items.
 */
export interface KnowledgeSearchFilters {
	category?: KnowledgeCategory;
	workflowId?: string;
	archived?: boolean;
	startDate?: number;
	endDate?: number;
	tags?: string[];
	offset?: number;
	limit?: number;
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
		archived: row.archived === 1,
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
	const row: Omit<InsertableKnowledgeItem, "id" | "created_at"> = {
		workflow_id: data.workflowId,
		card_id: data.cardId ?? null,
		session_id: data.sessionId ?? null,
		turn_id: data.turnId ?? null,
		title: data.title,
		content: data.content,
		category: data.category,
		tags_json: JSON.stringify(data.tags),
	};

	if (data.archived !== undefined) {
		row.archived = data.archived ? 1 : 0;
	}

	return row;
}

// =============================================================================
// Repository
// =============================================================================

export class KnowledgeRepository {
	constructor(readonly db: Kysely<KnowledgeDatabase>) {}

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
					archived: row.archived ?? 0,
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
			.where("archived", "=", 0)
			.orderBy("created_at", "desc")
			.execute();

		return rows.map(toKnowledgeItem);
	}

	/**
	 * Apply shared filter conditions to a knowledge_items query.
	 * Used by both search() and count() to keep filter logic in sync.
	 */
	private applyFilters<O>(
		query: SelectQueryBuilder<KnowledgeDatabase, "knowledge_items", O>,
		filters: Omit<KnowledgeSearchFilters, "offset" | "limit">,
	): SelectQueryBuilder<KnowledgeDatabase, "knowledge_items", O> {
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

		// Archived filtering: default to excluding archived items
		if (filters.archived === true) {
			query = query.where("archived", "=", 1);
		} else {
			// Default: exclude archived items (archived === false or undefined)
			query = query.where("archived", "=", 0);
		}

		return query;
	}

	/**
	 * Search knowledge items with optional filters.
	 * Returns items ordered by created_at desc.
	 */
	async search(filters: KnowledgeSearchFilters): Promise<KnowledgeItem[]> {
		const baseQuery = this.db.selectFrom("knowledge_items").selectAll();
		let orderedQuery = this.applyFilters(baseQuery, filters).orderBy(
			"created_at",
			"desc",
		);

		if (filters.limit !== undefined) {
			orderedQuery = orderedQuery.limit(filters.limit);
		}

		if (filters.offset !== undefined) {
			orderedQuery = orderedQuery.offset(filters.offset);
		}

		const rows = await orderedQuery.execute();

		return rows.map(toKnowledgeItem);
	}

	/**
	 * Count knowledge items matching optional filters.
	 * Uses the shared applyFilters() helper to stay in sync with search().
	 */
	async count(
		filters: Omit<KnowledgeSearchFilters, "offset" | "limit">,
	): Promise<number> {
		const baseQuery = this.db
			.selectFrom("knowledge_items")
			.select(this.db.fn.countAll<number>().as("count"));

		const query = this.applyFilters(baseQuery, filters);
		const result = await query.executeTakeFirstOrThrow();
		return Number(result.count);
	}

	/**
	 * Update a knowledge item by ID.
	 * Returns the updated item, or null if not found.
	 */
	async update(
		id: string,
		data: {
			title?: string;
			content?: string;
			category?: KnowledgeCategory;
			tags?: string[];
			archived?: boolean;
		},
	): Promise<KnowledgeItem | null> {
		const updateObj: UpdateableKnowledgeItem = {};

		if (data.title !== undefined) {
			updateObj.title = data.title;
		}
		if (data.content !== undefined) {
			updateObj.content = data.content;
		}
		if (data.category !== undefined) {
			updateObj.category = data.category;
		}
		if (data.tags !== undefined) {
			updateObj.tags_json = JSON.stringify(data.tags);
		}
		if (data.archived !== undefined) {
			updateObj.archived = data.archived ? 1 : 0;
		}

		if (Object.keys(updateObj).length === 0) {
			return this.getById(id);
		}

		await this.db
			.updateTable("knowledge_items")
			.set(updateObj)
			.where("id", "=", id)
			.execute();

		return this.getById(id);
	}

	/**
	 * Update a knowledge item and regenerate its embedding in a single transaction.
	 * Ensures the item text and embedding are always consistent — both succeed or
	 * both fail. The embedding buffer should be pre-computed before calling this
	 * method to keep the transaction short.
	 *
	 * Returns the updated item, or null if not found.
	 */
	async updateWithEmbedding(
		id: string,
		data: {
			title?: string;
			content?: string;
			category?: KnowledgeCategory;
			tags?: string[];
			archived?: boolean;
		},
		embedding: Buffer,
	): Promise<KnowledgeItem | null> {
		const updateObj: UpdateableKnowledgeItem = {};

		if (data.title !== undefined) {
			updateObj.title = data.title;
		}
		if (data.content !== undefined) {
			updateObj.content = data.content;
		}
		if (data.category !== undefined) {
			updateObj.category = data.category;
		}
		if (data.tags !== undefined) {
			updateObj.tags_json = JSON.stringify(data.tags);
		}
		if (data.archived !== undefined) {
			updateObj.archived = data.archived ? 1 : 0;
		}

		await this.db.transaction().execute(async (trx) => {
			if (Object.keys(updateObj).length > 0) {
				await trx
					.updateTable("knowledge_items")
					.set(updateObj)
					.where("id", "=", id)
					.execute();
			}

			await trx
				.insertInto("knowledge_embeddings")
				.values({
					id,
					embedding: new Uint8Array(embedding),
					created_at: Date.now(),
				})
				.onConflict((oc) =>
					oc.column("id").doUpdateSet({
						embedding: new Uint8Array(embedding),
						created_at: Date.now(),
					}),
				)
				.execute();
		});

		return this.getById(id);
	}

	/**
	 * Delete a knowledge item and its embedding by ID.
	 * Returns true if the item was deleted, false if it didn't exist.
	 */
	async delete(id: string): Promise<boolean> {
		return this.db.transaction().execute(async (trx) => {
			// Delete embedding first (foreign key reference)
			await trx
				.deleteFrom("knowledge_embeddings")
				.where("id", "=", id)
				.execute();

			// Delete the knowledge item
			const result = await trx
				.deleteFrom("knowledge_items")
				.where("id", "=", id)
				.executeTakeFirst();

			return BigInt(result.numDeletedRows) > 0n;
		});
	}
}
