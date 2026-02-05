import type { Kysely } from "kysely";
import type { KnowledgeDatabase } from "./types";

/**
 * Run all migrations for the knowledge database
 */
export async function migrateKnowledgeDb(
	db: Kysely<KnowledgeDatabase>,
): Promise<void> {
	await createKnowledgeItemsTable(db);
	await createKnowledgeEmbeddingsTable(db);
}

/**
 * Create the knowledge_items table for storing extracted knowledge.
 */
async function createKnowledgeItemsTable(
	db: Kysely<KnowledgeDatabase>,
): Promise<void> {
	await db.schema
		.createTable("knowledge_items")
		.ifNotExists()
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("workflow_id", "text", (col) => col.notNull())
		.addColumn("card_id", "text")
		.addColumn("session_id", "text")
		.addColumn("turn_id", "text")
		.addColumn("title", "text", (col) => col.notNull())
		.addColumn("content", "text", (col) => col.notNull())
		.addColumn("category", "text", (col) => col.notNull())
		.addColumn("tags_json", "text", (col) => col.notNull())
		.addColumn("created_at", "integer", (col) => col.notNull())
		.execute();

	// Index for filtering by workflow
	await db.schema
		.createIndex("idx_knowledge_items_workflow")
		.ifNotExists()
		.on("knowledge_items")
		.column("workflow_id")
		.execute();

	// Index for filtering by category
	await db.schema
		.createIndex("idx_knowledge_items_category")
		.ifNotExists()
		.on("knowledge_items")
		.column("category")
		.execute();

	// Index for ordering by created_at
	await db.schema
		.createIndex("idx_knowledge_items_created")
		.ifNotExists()
		.on("knowledge_items")
		.column("created_at")
		.execute();
}

/**
 * Create the knowledge_embeddings table for semantic search vectors.
 */
async function createKnowledgeEmbeddingsTable(
	db: Kysely<KnowledgeDatabase>,
): Promise<void> {
	await db.schema
		.createTable("knowledge_embeddings")
		.ifNotExists()
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("embedding", "blob", (col) => col.notNull())
		.addColumn("created_at", "integer", (col) => col.notNull())
		.addForeignKeyConstraint(
			"fk_knowledge_embeddings_item",
			["id"],
			"knowledge_items",
			["id"],
			(cb) => cb.onDelete("cascade"),
		)
		.execute();
}
