import type { Kysely } from "kysely";
import type { ProjectDatabase } from "./types";

/**
 * Run all migrations for the project database
 */
export async function migrateProjectDb(
	db: Kysely<ProjectDatabase>,
): Promise<void> {
	await createProjectMetaTable(db);
}

/**
 * Create the project_meta table
 */
async function createProjectMetaTable(
	db: Kysely<ProjectDatabase>,
): Promise<void> {
	await db.schema
		.createTable("project_meta")
		.ifNotExists()
		.addColumn("key", "text", (col) => col.primaryKey())
		.addColumn("value", "text", (col) => col.notNull())
		.addColumn("updated_at", "integer", (col) => col.notNull())
		.execute();
}
