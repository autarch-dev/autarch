import { Database } from "bun:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { Kysely } from "kysely";
import { BunSqliteDialect } from "kysely-bun-sqlite";
import { migrateGlobalDb } from "./migrations";
import type { GlobalDatabase } from "./types";

const AUTARCH_DIR = ".autarch";
const DB_FILENAME = "profile.db";

let instance: Kysely<GlobalDatabase> | null = null;

/**
 * Get the path to the global Autarch directory (~/.autarch)
 */
export function getGlobalAutarchDir(): string {
	return join(homedir(), AUTARCH_DIR);
}

/**
 * Get the path to the global profile database (~/.autarch/profile.db)
 */
export function getGlobalDbPath(): string {
	return join(getGlobalAutarchDir(), DB_FILENAME);
}

/**
 * Ensure the global Autarch directory exists
 */
function ensureGlobalDir(): void {
	const dir = getGlobalAutarchDir();
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}
}

/**
 * Initialize and return the global database connection.
 * Creates the ~/.autarch directory and profile.db if they don't exist.
 */
export async function getGlobalDb(): Promise<Kysely<GlobalDatabase>> {
	if (!instance) {
		ensureGlobalDir();
		const sqlite = new Database(getGlobalDbPath(), { create: true });

		instance = new Kysely<GlobalDatabase>({
			dialect: new BunSqliteDialect({ database: sqlite }),
		});

		await migrateGlobalDb(instance);
	}
	return instance;
}

/**
 * Close the global database connection
 */
export async function closeGlobalDb(): Promise<void> {
	if (instance) {
		await instance.destroy();
		instance = null;
	}
}

export type { GlobalDatabase, SettingsTable } from "./types";
