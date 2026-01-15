/**
 * Embeddings database schema types
 */

export interface EmbeddingsDatabase {
	embedding_chunks: EmbeddingChunksTable;
	vec_chunks: VecChunksTable;
	embedding_scopes: EmbeddingScopesTable;
	file_chunk_mappings: FileChunkMappingsTable;
}

/**
 * Stores deduplicated embedding chunk metadata by content hash.
 */
export interface EmbeddingChunksTable {
	content_hash: string; // SHA256 hash, primary key
	chunk_text: string;
	token_count: number;
	computed_at: number; // Unix timestamp
}

/**
 * Stores embedding vectors for similarity search.
 */
export interface VecChunksTable {
	content_hash: string;
	embedding: Uint8Array; // float[768] stored as BLOB
}

/**
 * Defines searchable index boundaries (main repo vs worktrees).
 */
export interface EmbeddingScopesTable {
	id: string; // ULID
	type: "main" | "worktree";
	root_path: string; // Absolute path to scope root
	owner_id: string | null; // Pulse ID for worktree scopes
	last_indexed_at: number | null; // Unix timestamp
}

/**
 * Links files to their embedding chunks within a scope.
 */
export interface FileChunkMappingsTable {
	scope_id: string;
	file_path: string; // Relative path from scope root
	content_hash: string; // References embedding_chunks
	chunk_index: number; // Order within the file
	start_line: number; // 1-based
	end_line: number; // 1-based, inclusive
}
