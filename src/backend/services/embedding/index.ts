/**
 * Embedding service for semantic code search.
 *
 * Provides:
 * - indexProject: Index all code in a project directory
 * - search: Semantic search over indexed code
 * - getIndexingStatus: Check if indexing is in progress
 * - preloadModel: Preload the embedding model for faster first query
 * - startWatching: Watch for file changes and update index incrementally
 */

export { chunkText, estimateTokens, type TextChunk } from "./chunker";
export {
	EXCLUDED_DIRS,
	EXTENSIONS,
	isExcludedDir,
	isLockFile,
	isSupportedExtension,
	LOCK_FILES,
	MAX_FILE_SIZE_FOR_EMBEDDING as MAX_FILE_SIZE,
	MAX_LINE_LENGTH,
	pathContainsExcludedDir,
	SUPPORTED_EXTENSIONS,
} from "./config";
export {
	calculateTotalSize,
	findIndexableFiles,
	type IndexableFile,
	readFileIfText,
} from "./files";
export {
	getIndexingStatus,
	indexProject,
	removeFile,
	search,
	updateFile,
} from "./indexer";
export {
	EMBEDDING_DIMENSIONS,
	initEmbed,
	isEmbeddingAvailable,
	MAX_TOKENS,
	preloadModel,
	terminateEmbed,
	terminateWorker,
} from "./provider";
export { isWatching, startWatching, stopWatching } from "./watcher";
