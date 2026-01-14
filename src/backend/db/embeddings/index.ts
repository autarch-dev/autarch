import { Database } from "bun:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { Kysely } from "kysely";
import { BunSqliteDialect } from "kysely-bun-sqlite";
import * as sqliteVec from "sqlite-vec";
import { getProjectAutarchDir } from "../project";
import { migrateEmbeddingsDb } from "./migrations";
import type { EmbeddingsDatabase } from "./types";

const DB_FILENAME = "code_embeddings.db";

const connections = new Map<string, Kysely<EmbeddingsDatabase>>();

/**
 * Get the path to the embeddings database (.autarch/code_embeddings.db)
 */
export function getEmbeddingsDbPath(projectRoot: string): string {
	return join(getProjectAutarchDir(projectRoot), DB_FILENAME);
}

/**
 * Initialize and return the embeddings database connection.
 * Loads the sqlite-vec extension for vector operations.
 *
 * @param projectRoot - The root directory of the project (defaults to cwd)
 */
export async function getEmbeddingsDb(
	projectRoot: string = process.cwd(),
): Promise<Kysely<EmbeddingsDatabase>> {
	let db = connections.get(projectRoot);

	if (!db) {
		const autarchDir = getProjectAutarchDir(projectRoot);
		if (!existsSync(autarchDir)) {
			mkdirSync(autarchDir, { recursive: true });
		}

		const sqlite = new Database(getEmbeddingsDbPath(projectRoot), {
			create: true,
		});

		// Load sqlite-vec extension for vector operations
		sqliteVec.load(sqlite);

		db = new Kysely<EmbeddingsDatabase>({
			dialect: new BunSqliteDialect({ database: sqlite }),
		});

		await migrateEmbeddingsDb(db);
		connections.set(projectRoot, db);
	}

	return db;
}

/**
 * Close a specific embeddings database connection
 */
export async function closeEmbeddingsDb(projectRoot: string): Promise<void> {
	const db = connections.get(projectRoot);
	if (db) {
		await db.destroy();
		connections.delete(projectRoot);
	}
}

/**
 * Close all embeddings database connections
 */
export async function closeAllEmbeddingsDbs(): Promise<void> {
	for (const [projectRoot] of connections) {
		await closeEmbeddingsDb(projectRoot);
	}
}

export type { EmbeddingsDatabase } from "./types";
