/**
 * Database services entry point
 *
 * Exports access to all database services:
 * - Global DB: ~/.autarch/profile.db (user-wide settings)
 * - Project DB: .autarch/project.db (per-project data)
 * - Embeddings DB: .autarch/code_embeddings.db (vector embeddings for semantic search)
 */

export {
	closeAllEmbeddingsDbs,
	closeEmbeddingsDb,
	type EmbeddingsDatabase,
	getEmbeddingsDb,
	getEmbeddingsDbPath,
} from "./embeddings";
export {
	closeGlobalDb,
	type GlobalDatabase,
	getGlobalAutarchDir,
	getGlobalDb,
	getGlobalDbPath,
	type SettingsTable,
} from "./global";
export {
	closeAllProjectDbs,
	closeProjectDb,
	getProjectAutarchDir,
	getProjectDb,
	getProjectDbPath,
	type ProjectDatabase,
	type ProjectMetaTable,
} from "./project";

import { closeAllEmbeddingsDbs } from "./embeddings";
import { closeGlobalDb } from "./global";
import { closeAllProjectDbs } from "./project";

/**
 * Close all database connections (useful for cleanup)
 */
export async function closeAllDbs(): Promise<void> {
	await closeGlobalDb();
	await closeAllProjectDbs();
	await closeAllEmbeddingsDbs();
}
