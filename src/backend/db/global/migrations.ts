import type { Kysely } from "kysely";
import type { GlobalDatabase } from "./types";

/**
 * Run all migrations for the global database
 */
export async function migrateGlobalDb(
	db: Kysely<GlobalDatabase>,
): Promise<void> {
	await createSettingsTable(db);
	await createCustomProvidersTable(db);
	await createCustomModelsTable(db);
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

async function createCustomProvidersTable(
	db: Kysely<GlobalDatabase>,
): Promise<void> {
	await db.schema
		.createTable("custom_providers")
		.ifNotExists()
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("label", "text", (col) => col.notNull())
		.addColumn("base_url", "text", (col) => col.notNull())
		.addColumn("headers_json", "text")
		.addColumn("created_at", "integer", (col) => col.notNull())
		.addColumn("updated_at", "integer", (col) => col.notNull())
		.execute();
}

async function createCustomModelsTable(
	db: Kysely<GlobalDatabase>,
): Promise<void> {
	await db.schema
		.createTable("custom_models")
		.ifNotExists()
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("provider_id", "text", (col) =>
			col.notNull().references("custom_providers.id"),
		)
		.addColumn("model_name", "text", (col) => col.notNull())
		.addColumn("label", "text", (col) => col.notNull())
		.addColumn("prompt_token_cost", "real", (col) => col.notNull())
		.addColumn("completion_token_cost", "real", (col) => col.notNull())
		.addColumn("cache_read_cost", "real")
		.addColumn("cache_write_cost", "real")
		.addColumn("created_at", "integer", (col) => col.notNull())
		.addColumn("updated_at", "integer", (col) => col.notNull())
		.execute();
}
