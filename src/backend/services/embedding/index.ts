/**
 * Embedding service for semantic code search.
 *
 * Provides:
 * - indexProject: Index all code in a project directory
 * - search: Semantic search over indexed code
 * - getIndexingStatus: Check if indexing is in progress
 * - preloadModel: Preload the embedding model for faster first query
 */

export { chunkText, estimateTokens, type TextChunk } from "./chunker";
export {
	calculateTotalSize,
	findIndexableFiles,
	type IndexableFile,
	readFileIfText,
} from "./files";
export { getIndexingStatus, indexProject, search } from "./indexer";
export { EMBEDDING_DIMENSIONS, MAX_TOKENS, preloadModel } from "./provider";
