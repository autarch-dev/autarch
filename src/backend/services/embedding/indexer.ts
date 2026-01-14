import { sql } from "kysely";
import { getEmbeddingsDb } from "@/backend/db/embeddings";
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

		console.log(
			`Found ${files.length} files to index (${(totalBytes / 1024).toFixed(1)} KB)`,
		);

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

						// Store vector in virtual table
						// vec0 virtual tables don't support INSERT OR IGNORE, so catch duplicates
						try {
							await sql`
								INSERT INTO vec_chunks (content_hash, embedding)
								VALUES (${chunk.contentHash}, ${embedding})
							`.execute(db);
						} catch (e) {
							// Ignore duplicate key errors from race conditions
							if (!(e instanceof Error && e.message.includes("UNIQUE"))) {
								throw e;
							}
						}
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
							})
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
		console.log(
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
 * Perform semantic search over indexed code using sqlite-vec.
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

	// Use sqlite-vec's native vector search with match operator
	// First get the top matching content hashes by vector similarity
	const vecResults = await sql<{ content_hash: string; distance: number }>`
		SELECT content_hash, distance
		FROM vec_chunks
		WHERE embedding MATCH ${queryEmbedding}
		ORDER BY distance
		LIMIT ${limit * 2}
	`.execute(db);

	if (vecResults.rows.length === 0) {
		return [];
	}

	// Get the content hashes that are in our scope
	const contentHashes = vecResults.rows.map((r) => r.content_hash);

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
		.where("file_chunk_mappings.content_hash", "in", contentHashes)
		.execute();

	// Create a map for quick lookup of distances
	const distanceMap = new Map(
		vecResults.rows.map((r) => [r.content_hash, r.distance]),
	);

	// Build results with similarity scores (convert distance to similarity)
	const results: SemanticSearchResult[] = mappings.map((mapping) => {
		const distance = distanceMap.get(mapping.content_hash) ?? 1;
		// Convert L2 distance to similarity score (closer = higher score)
		// Using 1 / (1 + distance) to normalize to 0-1 range
		const score = 1 / (1 + distance);

		return {
			filePath: mapping.file_path,
			startLine: mapping.start_line,
			endLine: mapping.end_line,
			snippet: mapping.chunk_text,
			score,
		};
	});

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

			// Store vector in virtual table
			// vec0 virtual tables don't support INSERT OR IGNORE, so catch duplicates
			try {
				await sql`
					INSERT INTO vec_chunks (content_hash, embedding)
					VALUES (${chunk.contentHash}, ${embedding})
				`.execute(db);
			} catch (e) {
				// Ignore duplicate key errors from race conditions
				if (!(e instanceof Error && e.message.includes("UNIQUE"))) {
					throw e;
				}
			}
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
				})
			)
			.execute();
	}

	return true;
}

/**
 * Remove a file from the index.
 * Used when files are deleted.
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

	await db
		.deleteFrom("file_chunk_mappings")
		.where("scope_id", "=", scopeId)
		.where("file_path", "=", relativePath)
		.execute();
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
