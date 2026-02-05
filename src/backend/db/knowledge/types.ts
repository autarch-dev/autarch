/**
 * Knowledge database schema types
 */

// =============================================================================
// Database Interface
// =============================================================================

export interface KnowledgeDatabase {
	knowledge_items: KnowledgeItemsTable;
	knowledge_embeddings: KnowledgeEmbeddingsTable;
}

// =============================================================================
// Knowledge Item Categories
// =============================================================================

export type KnowledgeCategory =
	| "pattern"
	| "gotcha"
	| "tool-usage"
	| "process-improvement";

// =============================================================================
// Knowledge Items
// =============================================================================

/**
 * Stores extracted knowledge items from completed workflows.
 * Each item has full provenance traceability via workflow_id, card_id, session_id, and turn_id.
 */
export interface KnowledgeItemsTable {
	id: string; // Primary key (knowledge ID)
	workflow_id: string; // Source workflow
	card_id: string | null; // Source artifact card (scope, research, review)
	session_id: string | null; // Source session
	turn_id: string | null; // Source turn for fine-grained provenance
	title: string; // Brief title for the knowledge item
	content: string; // Full content/description of the knowledge
	category: KnowledgeCategory; // Type of knowledge
	tags_json: string; // JSON array of string tags for filtering
	created_at: number; // Unix timestamp
}

// =============================================================================
// Knowledge Embeddings
// =============================================================================

/**
 * Stores embedding vectors for semantic search over knowledge items.
 */
export interface KnowledgeEmbeddingsTable {
	id: string; // Foreign key to knowledge_items.id
	embedding: Uint8Array; // Embedding vector stored as BLOB
	created_at: number; // Unix timestamp
}

// =============================================================================
// Insertable Types (for creating new records)
// =============================================================================

export interface InsertableKnowledgeItem {
	id: string;
	workflow_id: string;
	card_id?: string | null;
	session_id?: string | null;
	turn_id?: string | null;
	title: string;
	content: string;
	category: KnowledgeCategory;
	tags_json: string;
	created_at: number;
}

export interface InsertableKnowledgeEmbedding {
	id: string;
	embedding: Uint8Array;
	created_at: number;
}

// =============================================================================
// Updateable Types (for updating existing records)
// =============================================================================

export interface UpdateableKnowledgeItem {
	title?: string;
	content?: string;
	category?: KnowledgeCategory;
	tags_json?: string;
}

export interface UpdateableKnowledgeEmbedding {
	embedding?: Uint8Array;
}
