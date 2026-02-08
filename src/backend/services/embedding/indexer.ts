import { getEmbeddingsDb } from "@/backend/db/embeddings";
import { log } from "@/backend/logger";
import { broadcast } from "@/backend/ws";
import type { SemanticSearchResult } from "@/shared/schemas/embedding";
import { createIndexingProgressEvent } from "@/shared/schemas/events";
import { chunkText } from "./chunker";
import {
	calculateTotalSize,
	findIndexableFiles,
	readFileIfText,
} from "./files";
import { embed } from "./provider";

// =============================================================================
// Types
// =============================================================================

interface IndexingState {
	isIndexing: boolean;
	scopeId: string | null;
}

const state: IndexingState = {
	isIndexing: false,
	scopeId: null,
};

// =============================================================================
// Vector Similarity
// =============================================================================

/**
 * Compute cosine similarity between two vectors.
 * Returns a value between -1 and 1, where 1 means identical direction.
 */
function cosineSimilarity(a: Float32Array, b: Float32Array): number {
	let dot = 0;
	let normA = 0;
	let normB = 0;
	// Both arrays have the same length (768 dimensions)
	for (const [i, ai] of a.entries()) {
		const bi = b[i] ?? 0;
		dot += ai * bi;
		normA += ai * ai;
		normB += bi * bi;
	}
	return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Convert a BLOB (Buffer/Uint8Array) back to Float32Array.
 */
function blobToFloat32Array(blob: Buffer | Uint8Array): Float32Array {
	return new Float32Array(blob.buffer, blob.byteOffset, blob.byteLength / 4);
}

// =============================================================================
// Scope Management
// =============================================================================

/**
 * Get or create the main scope for a project.
 */
async function getOrCreateMainScope(projectRoot: string): Promise<string> {
	const db = await getEmbeddingsDb(projectRoot);

	// Check for existing main scope
	const existing = await db
		.selectFrom("embedding_scopes")
		.select("id")
		.where("type", "=", "main")
		.where("root_path", "=", projectRoot)
		.executeTakeFirst();

	if (existing) {
		return existing.id;
	}

	// Create new main scope with ULID-style ID
	const id = generateId();
	await db
		.insertInto("embedding_scopes")
		.values({
			id,
			type: "main",
			root_path: projectRoot,
			owner_id: null,
			last_indexed_at: null,
		})
		.execute();

	return id;
}

/**
 * Generate a simple unique ID (timestamp + random).
 */
function generateId(): string {
	const timestamp = Date.now().toString(36);
	const random = Math.random().toString(36).slice(2, 8);
	return `${timestamp}${random}`;
}

// =============================================================================
// Indexing
// =============================================================================

/**
 * Index all files in a project directory.
 * Broadcasts progress events via WebSocket.
 *
 * @param projectRoot - The root directory of the project
 * @param signal - Optional abort signal for cancellation
 */
export async function indexProject(
	projectRoot: string,
	signal?: AbortSignal,
): Promise<void> {
	if (state.isIndexing) {
		throw new Error("Indexing already in progress");
	}

	const db = await getEmbeddingsDb(projectRoot);
	const scopeId = await getOrCreateMainScope(projectRoot);

	state.isIndexing = true;
	state.scopeId = scopeId;

	try {
		// Phase: Analyzing
		broadcast(
			createIndexingProgressEvent({
				phase: "analyzing",
				filesProcessed: 0,
				totalFiles: 0,
				bytesProcessed: 0,
				totalBytes: 0,
			}),
		);

		// Find all indexable files
		const files = await findIndexableFiles(projectRoot);
		const totalBytes = calculateTotalSize(files);

		log.embedding.info(
			`Found ${files.length} files to index (${(totalBytes / 1024).toFixed(1)} KB)`,
		);

		if (signal?.aborted) {
			return;
		}

		// Reconcile: remove files that are indexed but no longer on disk
		const indexedPaths = await db
			.selectFrom("file_chunk_mappings")
			.select("file_path")
			.distinct()
			.where("scope_id", "=", scopeId)
			.execute();

		const onDiskPaths = new Set(files.map((f) => f.relativePath));
		const stalePaths = indexedPaths
			.map((row) => row.file_path)
			.filter((p) => !onDiskPaths.has(p));

		if (stalePaths.length > 0) {
			log.embedding.info(
				`Removing ${stalePaths.length} stale file(s) from index`,
			);
			for (const stalePath of stalePaths) {
				await removeFile(projectRoot, stalePath);
			}
		}

		if (signal?.aborted) {
			return;
		}

		// Phase: Started
		broadcast(
			createIndexingProgressEvent({
				phase: "started",
				filesProcessed: 0,
				totalFiles: files.length,
				bytesProcessed: 0,
				totalBytes,
			}),
		);

		let filesProcessed = 0;
		let bytesProcessed = 0;
		let filesEmbedded = 0;

		// Process each file
		for (const file of files) {
			if (signal?.aborted) {
				return;
			}

			// Read file content
			const content = await readFileIfText(file.absolutePath);
			if (content === null) {
				// Binary file, skip
				filesProcessed++;
				bytesProcessed += file.size;
				continue;
			}

			// Chunk the content
			const chunks = chunkText(content);
			const newHashes = chunks.map((c) => c.contentHash);

			// Get existing chunk hashes for this file
			const existingMappings = await db
				.selectFrom("file_chunk_mappings")
				.select(["content_hash", "chunk_index"])
				.where("scope_id", "=", scopeId)
				.where("file_path", "=", file.relativePath)
				.orderBy("chunk_index")
				.execute();

			const existingHashes = existingMappings.map((m) => m.content_hash);

			// If hashes match exactly, file is unchanged - skip embedding
			const unchanged =
				newHashes.length === existingHashes.length &&
				newHashes.every((hash, i) => hash === existingHashes[i]);

			if (!unchanged) {
				filesEmbedded++;

				// Delete existing mappings
				await db
					.deleteFrom("file_chunk_mappings")
					.where("scope_id", "=", scopeId)
					.where("file_path", "=", file.relativePath)
					.execute();

				// Process each chunk
				for (let i = 0; i < chunks.length; i++) {
					const chunk = chunks[i];
					if (!chunk) continue;

					// Check if chunk already exists (deduplication across files)
					const existing = await db
						.selectFrom("embedding_chunks")
						.select("content_hash")
						.where("content_hash", "=", chunk.contentHash)
						.executeTakeFirst();

					if (!existing) {
						// Generate embedding
						const embedding = await embed(chunk.text);

						// Store chunk metadata (ignore if already exists due to race)
						await db
							.insertInto("embedding_chunks")
							.values({
								content_hash: chunk.contentHash,
								chunk_text: chunk.text,
								token_count: chunk.tokenCount,
								computed_at: Date.now(),
							})
							.onConflict((oc) => oc.column("content_hash").doNothing())
							.execute();

						// Store embedding vector as BLOB
						await db
							.insertInto("vec_chunks")
							.values({
								content_hash: chunk.contentHash,
								embedding: Buffer.from(embedding.buffer),
							})
							.onConflict((oc) => oc.column("content_hash").doNothing())
							.execute();
					}

					// Create file-chunk mapping (replace if exists)
					await db
						.insertInto("file_chunk_mappings")
						.values({
							scope_id: scopeId,
							file_path: file.relativePath,
							content_hash: chunk.contentHash,
							chunk_index: i,
							start_line: chunk.startLine,
							end_line: chunk.endLine,
						})
						.onConflict((oc) =>
							oc.columns(["scope_id", "file_path", "chunk_index"]).doUpdateSet({
								content_hash: chunk.contentHash,
								start_line: chunk.startLine,
								end_line: chunk.endLine,
							}),
						)
						.execute();
				}
			}

			filesProcessed++;
			bytesProcessed += file.size;

			// Broadcast progress
			broadcast(
				createIndexingProgressEvent({
					phase: "in_progress",
					filesProcessed,
					totalFiles: files.length,
					bytesProcessed,
					totalBytes,
				}),
			);
		}

		// Update scope timestamp
		await db
			.updateTable("embedding_scopes")
			.set({ last_indexed_at: Date.now() })
			.where("id", "=", scopeId)
			.execute();

		// Phase: Completed
		broadcast(
			createIndexingProgressEvent({
				phase: "completed",
				filesProcessed,
				totalFiles: files.length,
				bytesProcessed,
				totalBytes,
			}),
		);

		const skipped = files.length - filesEmbedded;
		log.embedding.success(
			`Indexing complete: ${filesEmbedded} embedded, ${skipped} unchanged`,
		);
	} finally {
		state.isIndexing = false;
		state.scopeId = null;
	}
}

// =============================================================================
// Search
// =============================================================================

/**
 * Perform semantic search over indexed code using cosine similarity.
 *
 * @param projectRoot - The root directory of the project
 * @param query - The search query text
 * @param limit - Maximum number of results (default 10)
 * @returns Array of search results sorted by similarity
 */
export async function search(
	projectRoot: string,
	query: string,
	limit = 10,
): Promise<SemanticSearchResult[]> {
	const db = await getEmbeddingsDb(projectRoot);
	const scopeId = await getOrCreateMainScope(projectRoot);

	// Generate query embedding
	const queryEmbedding = await embed(query);

	// Fetch all embeddings from the database
	const allEmbeddings = await db
		.selectFrom("vec_chunks")
		.select(["content_hash", "embedding"])
		.execute();

	if (allEmbeddings.length === 0) {
		return [];
	}

	// Compute similarity scores for all embeddings
	const similarities: Array<{ contentHash: string; score: number }> = [];
	for (const row of allEmbeddings) {
		const embedding = blobToFloat32Array(row.embedding as Buffer);
		const score = cosineSimilarity(queryEmbedding, embedding);
		similarities.push({ contentHash: row.content_hash, score });
	}

	// Sort by similarity and take top candidates
	similarities.sort((a, b) => b.score - a.score);
	const topCandidates = similarities.slice(0, limit * 2);
	const topHashes = topCandidates.map((c) => c.contentHash);

	// Join with file mappings to get file context, filtered by scope
	const mappings = await db
		.selectFrom("file_chunk_mappings")
		.innerJoin(
			"embedding_chunks",
			"embedding_chunks.content_hash",
			"file_chunk_mappings.content_hash",
		)
		.select([
			"file_chunk_mappings.file_path",
			"file_chunk_mappings.start_line",
			"file_chunk_mappings.end_line",
			"file_chunk_mappings.content_hash",
			"embedding_chunks.chunk_text",
		])
		.where("file_chunk_mappings.scope_id", "=", scopeId)
		.where("file_chunk_mappings.content_hash", "in", topHashes)
		.execute();

	// Create a map for quick lookup of scores
	const scoreMap = new Map(topCandidates.map((c) => [c.contentHash, c.score]));

	// Build results with similarity scores
	const results: SemanticSearchResult[] = mappings.map((mapping) => ({
		filePath: mapping.file_path,
		startLine: mapping.start_line,
		endLine: mapping.end_line,
		snippet: mapping.chunk_text,
		score: scoreMap.get(mapping.content_hash) ?? 0,
	}));

	// Sort by score descending and take limit
	results.sort((a, b) => b.score - a.score);
	return results.slice(0, limit);
}

// =============================================================================
// Incremental Updates
// =============================================================================

/**
 * Update embeddings for a single file.
 * Skips re-embedding if chunk hashes haven't changed.
 *
 * @param projectRoot - The root directory of the project
 * @param relativePath - Path relative to project root
 * @returns true if file was re-indexed, false if unchanged
 */
export async function updateFile(
	projectRoot: string,
	relativePath: string,
): Promise<boolean> {
	const db = await getEmbeddingsDb(projectRoot);
	const scopeId = await getOrCreateMainScope(projectRoot);
	const absolutePath = `${projectRoot}/${relativePath}`;

	// Read file content
	const content = await readFileIfText(absolutePath);

	// If file is binary or unreadable, remove from index
	if (content === null) {
		await removeFile(projectRoot, relativePath);
		return true;
	}

	// Chunk the content
	const chunks = chunkText(content);
	const newHashes = chunks.map((c) => c.contentHash);

	// Get existing chunk hashes for this file
	const existingMappings = await db
		.selectFrom("file_chunk_mappings")
		.select(["content_hash", "chunk_index"])
		.where("scope_id", "=", scopeId)
		.where("file_path", "=", relativePath)
		.orderBy("chunk_index")
		.execute();

	const existingHashes = existingMappings.map((m) => m.content_hash);

	// If hashes match exactly, file is unchanged - skip
	if (
		newHashes.length === existingHashes.length &&
		newHashes.every((hash, i) => hash === existingHashes[i])
	) {
		return false;
	}

	// Hashes differ - re-index the file
	// Delete existing mappings
	await db
		.deleteFrom("file_chunk_mappings")
		.where("scope_id", "=", scopeId)
		.where("file_path", "=", relativePath)
		.execute();

	// Process each chunk
	for (let i = 0; i < chunks.length; i++) {
		const chunk = chunks[i];
		if (!chunk) continue;

		// Check if chunk already exists (deduplication across files)
		const existing = await db
			.selectFrom("embedding_chunks")
			.select("content_hash")
			.where("content_hash", "=", chunk.contentHash)
			.executeTakeFirst();

		if (!existing) {
			// Generate embedding
			const embedding = await embed(chunk.text);

			// Store chunk metadata (ignore if already exists due to race)
			await db
				.insertInto("embedding_chunks")
				.values({
					content_hash: chunk.contentHash,
					chunk_text: chunk.text,
					token_count: chunk.tokenCount,
					computed_at: Date.now(),
				})
				.onConflict((oc) => oc.column("content_hash").doNothing())
				.execute();

			// Store embedding vector as BLOB
			await db
				.insertInto("vec_chunks")
				.values({
					content_hash: chunk.contentHash,
					embedding: Buffer.from(embedding.buffer),
				})
				.onConflict((oc) => oc.column("content_hash").doNothing())
				.execute();
		}

		// Create file-chunk mapping (replace if exists)
		await db
			.insertInto("file_chunk_mappings")
			.values({
				scope_id: scopeId,
				file_path: relativePath,
				content_hash: chunk.contentHash,
				chunk_index: i,
				start_line: chunk.startLine,
				end_line: chunk.endLine,
			})
			.onConflict((oc) =>
				oc.columns(["scope_id", "file_path", "chunk_index"]).doUpdateSet({
					content_hash: chunk.contentHash,
					start_line: chunk.startLine,
					end_line: chunk.endLine,
				}),
			)
			.execute();
	}

	return true;
}

/**
 * Remove a file from the index.
 * Used when files are deleted.
 *
 * Cleans up orphaned rows in embedding_chunks and vec_chunks when no
 * remaining file_chunk_mappings reference a given content_hash (across
 * all scopes).
 *
 * @param projectRoot - The root directory of the project
 * @param relativePath - Path relative to project root
 */
export async function removeFile(
	projectRoot: string,
	relativePath: string,
): Promise<void> {
	const db = await getEmbeddingsDb(projectRoot);
	const scopeId = await getOrCreateMainScope(projectRoot);

	// Collect content hashes referenced by this file before deletion
	const mappings = await db
		.selectFrom("file_chunk_mappings")
		.select("content_hash")
		.where("scope_id", "=", scopeId)
		.where("file_path", "=", relativePath)
		.execute();

	const contentHashes = [...new Set(mappings.map((m) => m.content_hash))];

	// Delete mappings and clean up orphaned chunks atomically
	await db.transaction().execute(async (trx) => {
		// Delete the file's chunk mappings
		await trx
			.deleteFrom("file_chunk_mappings")
			.where("scope_id", "=", scopeId)
			.where("file_path", "=", relativePath)
			.execute();

		// Clean up orphaned chunks — bulk-delete hashes no longer referenced
		// by any file_chunk_mappings row (across all scopes)
		if (contentHashes.length > 0) {
			const referencedHashes = trx
				.selectFrom("file_chunk_mappings")
				.select("content_hash")
				.where("content_hash", "in", contentHashes);

			await trx
				.deleteFrom("embedding_chunks")
				.where("content_hash", "in", contentHashes)
				.where("content_hash", "not in", referencedHashes)
				.execute();

			await trx
				.deleteFrom("vec_chunks")
				.where("content_hash", "in", contentHashes)
				.where("content_hash", "not in", referencedHashes)
				.execute();
		}
	});
}

// =============================================================================
// Status
// =============================================================================

/**
 * Get current indexing status.
 */
export function getIndexingStatus(): IndexingState {
	return { ...state };
}
