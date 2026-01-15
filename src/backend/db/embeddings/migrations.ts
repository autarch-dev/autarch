import type { Kysely } from "kysely";
import type { EmbeddingsDatabase } from "./types";

/**
 * Run all migrations for the embeddings database
 */
export async function migrateEmbeddingsDb(
	db: Kysely<EmbeddingsDatabase>,
): Promise<void> {
	await createEmbeddingChunksTable(db);
	await createVecChunksTable(db);
	await createEmbeddingScopesTable(db);
	await createFileChunkMappingsTable(db);
}

/**
 * Create the embedding_chunks table for chunk metadata.
 */
async function createEmbeddingChunksTable(
	db: Kysely<EmbeddingsDatabase>,
): Promise<void> {
	await db.schema
		.createTable("embedding_chunks")
		.ifNotExists()
		.addColumn("content_hash", "text", (col) => col.primaryKey())
		.addColumn("chunk_text", "text", (col) => col.notNull())
		.addColumn("token_count", "integer", (col) => col.notNull())
		.addColumn("computed_at", "integer", (col) => col.notNull())
		.execute();
}

/**
 * Create the vec_chunks table for storing embedding vectors.
 * Embeddings are stored as BLOBs and similarity is computed in JavaScript.
 */
async function createVecChunksTable(
	db: Kysely<EmbeddingsDatabase>,
): Promise<void> {
	await db.schema
		.createTable("vec_chunks")
		.ifNotExists()
		.addColumn("content_hash", "text", (col) => col.primaryKey())
		.addColumn("embedding", "blob", (col) => col.notNull())
		.execute();
}

/**
 * Create the embedding_scopes table
 */
async function createEmbeddingScopesTable(
	db: Kysely<EmbeddingsDatabase>,
): Promise<void> {
	await db.schema
		.createTable("embedding_scopes")
		.ifNotExists()
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("type", "text", (col) => col.notNull())
		.addColumn("root_path", "text", (col) => col.notNull())
		.addColumn("owner_id", "text")
		.addColumn("last_indexed_at", "integer")
		.execute();
}

/**
 * Create the file_chunk_mappings table with composite primary key
 */
async function createFileChunkMappingsTable(
	db: Kysely<EmbeddingsDatabase>,
): Promise<void> {
	await db.schema
		.createTable("file_chunk_mappings")
		.ifNotExists()
		.addColumn("scope_id", "text", (col) => col.notNull())
		.addColumn("file_path", "text", (col) => col.notNull())
		.addColumn("content_hash", "text", (col) => col.notNull())
		.addColumn("chunk_index", "integer", (col) => col.notNull())
		.addColumn("start_line", "integer", (col) => col.notNull())
		.addColumn("end_line", "integer", (col) => col.notNull())
		.addPrimaryKeyConstraint("file_chunk_mappings_pk", [
			"scope_id",
			"file_path",
			"chunk_index",
		])
		.execute();

	// Index for fast lookups by scope
	await db.schema
		.createIndex("file_chunk_mappings_scope_idx")
		.ifNotExists()
		.on("file_chunk_mappings")
		.column("scope_id")
		.execute();

	// Index for content hash lookups (for deduplication)
	await db.schema
		.createIndex("file_chunk_mappings_hash_idx")
		.ifNotExists()
		.on("file_chunk_mappings")
		.column("content_hash")
		.execute();
}
