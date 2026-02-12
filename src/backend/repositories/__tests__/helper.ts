/**
 * Shared test helper for repository tests
 *
 * Provides createTestDb() which stands up an in-memory SQLite database
 * with all migrations applied and returns repository instances.
 * Each test should call createTestDb() in beforeEach for full isolation.
 */

import { Database } from "bun:sqlite";
import { Kysely } from "kysely";
import { BunSqliteDialect } from "kysely-bun-sqlite";
import { migrateProjectDb } from "../../db/project/migrations";
import type { ProjectDatabase } from "../../db/project/types";
import { initRepositories } from "../index";
import type { Repositories } from "../types";

/**
 * Create a fresh in-memory database with all migrations applied
 * and all repository instances initialized.
 *
 * @returns The Kysely database instance and all repository instances
 */
export async function createTestDb(): Promise<{
	db: Kysely<ProjectDatabase>;
	repos: Repositories;
}> {
	const database = new Database(":memory:");
	const db = new Kysely<ProjectDatabase>({
		dialect: new BunSqliteDialect({ database }),
	});

	await migrateProjectDb(db);
	const repos = initRepositories(db);

	return { db, repos };
}

/**
 * Destroy a test database connection.
 * Call this in afterEach to clean up resources.
 */
// biome-ignore lint/suspicious/noExplicitAny: db.destroy() doesn't depend on the database type
export async function destroyTestDb(db: Kysely<any>): Promise<void> {
	await db.destroy();
}
