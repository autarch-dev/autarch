import type { Kysely } from "kysely";
import type { GlobalDatabase } from "./types";

/**
 * Run all migrations for the global database
 */
export async function migrateGlobalDb(
	db: Kysely<GlobalDatabase>,
): Promise<void> {
	await createSettingsTable(db);
}

/**
 * Create the settings table
 */
async function createSettingsTable(db: Kysely<GlobalDatabase>): Promise<void> {
	await db.schema
		.createTable("settings")
		.ifNotExists()
		.addColumn("key", "text", (col) => col.primaryKey())
		.addColumn("value", "text", (col) => col.notNull())
		.addColumn("updated_at", "integer", (col) => col.notNull())
		.execute();
}
