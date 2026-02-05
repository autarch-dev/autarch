import { Database } from "bun:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { Kysely } from "kysely";
import { BunSqliteDialect } from "kysely-bun-sqlite";
import { getProjectAutarchDir } from "../project";
import { migrateKnowledgeDb } from "./migrations";
import type { KnowledgeDatabase } from "./types";

const DB_FILENAME = "knowledge.db";

const connections = new Map<string, Kysely<KnowledgeDatabase>>();

/**
 * Get the path to the knowledge database (.autarch/knowledge.db)
 */
export function getKnowledgeDbPath(projectRoot: string): string {
	return join(getProjectAutarchDir(projectRoot), DB_FILENAME);
}

/**
 * Initialize and return the knowledge database connection.
 *
 * @param projectRoot - The root directory of the project (defaults to cwd)
 */
export async function getKnowledgeDb(
	projectRoot: string = process.cwd(),
): Promise<Kysely<KnowledgeDatabase>> {
	let db = connections.get(projectRoot);

	if (!db) {
		const autarchDir = getProjectAutarchDir(projectRoot);
		if (!existsSync(autarchDir)) {
			mkdirSync(autarchDir, { recursive: true });
		}

		const sqlite = new Database(getKnowledgeDbPath(projectRoot), {
			create: true,
		});

		// Enable WAL mode for better concurrency
		sqlite.run("PRAGMA journal_mode=WAL;");
		// Wait up to 5 seconds if database is locked
		sqlite.run("PRAGMA busy_timeout=5000;");

		db = new Kysely<KnowledgeDatabase>({
			dialect: new BunSqliteDialect({ database: sqlite }),
		});

		await migrateKnowledgeDb(db);
		connections.set(projectRoot, db);
	}

	return db;
}

/**
 * Close a specific knowledge database connection
 */
export async function closeKnowledgeDb(projectRoot: string): Promise<void> {
	const db = connections.get(projectRoot);
	if (db) {
		await db.destroy();
		connections.delete(projectRoot);
	}
}

/**
 * Close all knowledge database connections
 */
export async function closeAllKnowledgeDbs(): Promise<void> {
	for (const [projectRoot] of connections) {
		await closeKnowledgeDb(projectRoot);
	}
}

export type { KnowledgeDatabase } from "./types";
