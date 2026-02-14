import type { Kysely } from "kysely";
import { sql } from "kysely";
import { log } from "@/backend/logger";
import { embed } from "@/backend/services/embedding/provider";
import type { KnowledgeDatabase } from "./types";

/**
 * Run all migrations for the knowledge database
 */
export async function migrateKnowledgeDb(
	db: Kysely<KnowledgeDatabase>,
): Promise<void> {
	await createKnowledgeItemsTable(db);
	await createKnowledgeEmbeddingsTable(db);
	await addArchivedColumn(db);
	await backfillMissingEmbeddings(db);
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

/**
 * Backfill embeddings for knowledge items that were stored without one.
 * This covers items created by the fallback path in extraction.ts and
 * any items created before embedding-on-create was added.
 * Idempotent: the LEFT JOIN query only finds items missing embeddings.
 */
async function backfillMissingEmbeddings(
	db: Kysely<KnowledgeDatabase>,
): Promise<void> {
	try {
		const orphans = await db
			.selectFrom("knowledge_items as ki")
			.leftJoin("knowledge_embeddings as ke", "ki.id", "ke.id")
			.where("ke.id", "is", null)
			.select(["ki.id", "ki.title", "ki.content"])
			.execute();

		if (orphans.length === 0) {
			log.knowledge.debug("No orphaned knowledge items found");
			return;
		}

		log.knowledge.info(
			`Found ${orphans.length} knowledge items without embeddings, generating...`,
		);

		let backfilledCount = 0;

		for (const orphan of orphans) {
			try {
				const embeddingText = `${orphan.title}\n\n${orphan.content}`;
				const result = await embed(embeddingText);
				const buffer = Buffer.from(result.buffer);

				await db
					.insertInto("knowledge_embeddings")
					.values({
						id: orphan.id,
						embedding: new Uint8Array(buffer),
						created_at: Date.now(),
					})
					.execute();

				backfilledCount++;
			} catch (error) {
				log.knowledge.warn(
					`Failed to backfill embedding for knowledge item ${orphan.id}:`,
					error,
				);
			}
		}

		log.knowledge.info(
			`Successfully backfilled embeddings for ${backfilledCount} knowledge items`,
		);
	} catch (error) {
		log.knowledge.warn(
			"Embedding backfill skipped — embedding service may be unavailable:",
			error,
		);
	}
}

/**
 * Add the archived column to knowledge_items table.
 * Checks PRAGMA table_info for idempotency, consistent with the
 * IF NOT EXISTS pattern used elsewhere.
 */
async function addArchivedColumn(db: Kysely<KnowledgeDatabase>): Promise<void> {
	const { rows } = await sql<{
		name: string;
	}>`PRAGMA table_info(knowledge_items)`.execute(db);

	const hasArchived = rows.some((row) => row.name === "archived");
	if (hasArchived) {
		return;
	}

	await sql`ALTER TABLE knowledge_items ADD COLUMN archived INTEGER NOT NULL DEFAULT 0`.execute(
		db,
	);
}
