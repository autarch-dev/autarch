import { z } from "zod";

// =============================================================================
// Scope Types
// =============================================================================

export const EmbeddingScopeType = z.enum(["main", "worktree"]);
export type EmbeddingScopeType = z.infer<typeof EmbeddingScopeType>;

// =============================================================================
// Embedding Chunk
// =============================================================================

export const EmbeddingChunkSchema = z.object({
	contentHash: z.string(),
	chunkText: z.string(),
	tokenCount: z.number(),
	computedAt: z.date(),
});
export type EmbeddingChunk = z.infer<typeof EmbeddingChunkSchema>;

// =============================================================================
// Embedding Scope
// =============================================================================

export const EmbeddingScopeSchema = z.object({
	id: z.string(),
	type: EmbeddingScopeType,
	rootPath: z.string(),
	ownerId: z.string().nullable(),
	lastIndexedAt: z.date().nullable(),
});
export type EmbeddingScope = z.infer<typeof EmbeddingScopeSchema>;

// =============================================================================
// File Chunk Mapping
// =============================================================================

export const FileChunkMappingSchema = z.object({
	scopeId: z.string(),
	filePath: z.string(),
	contentHash: z.string(),
	chunkIndex: z.number(),
	startLine: z.number(),
	endLine: z.number(),
});
export type FileChunkMapping = z.infer<typeof FileChunkMappingSchema>;

// =============================================================================
// Search Results
// =============================================================================

export const SemanticSearchResultSchema = z.object({
	filePath: z.string(),
	startLine: z.number(),
	endLine: z.number(),
	snippet: z.string(),
	score: z.number(), // Cosine similarity (0.0 to 1.0)
});
export type SemanticSearchResult = z.infer<typeof SemanticSearchResultSchema>;

// =============================================================================
// API Request/Response Schemas
// =============================================================================

export const SearchRequestSchema = z.object({
	query: z.string().min(1, "Query is required"),
	scopeId: z.string().optional(),
	limit: z.number().min(1).max(100).default(10),
});
export type SearchRequest = z.infer<typeof SearchRequestSchema>;

export const SearchResponseSchema = z.object({
	results: z.array(SemanticSearchResultSchema),
});
export type SearchResponse = z.infer<typeof SearchResponseSchema>;

// =============================================================================
// Indexing Status
// =============================================================================

export const IndexingStatusSchema = z.object({
	isIndexing: z.boolean(),
	scopeId: z.string().nullable(),
	filesProcessed: z.number(),
	totalFiles: z.number(),
	lastIndexedAt: z.date().nullable(),
});
export type IndexingStatus = z.infer<typeof IndexingStatusSchema>;
