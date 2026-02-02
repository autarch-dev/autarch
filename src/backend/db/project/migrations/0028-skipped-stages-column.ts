import type { Kysely } from "kysely";
import type { ProjectDatabase } from "../types";

export async function migrate(db: Kysely<ProjectDatabase>): Promise<void> {
	// Add skipped_stages column to workflows table
	// Stores JSON array of skipped stage names (e.g., '["researching", "planning"]')
	try {
		await db.schema
			.alterTable("workflows")
			.addColumn("skipped_stages", "text", (col) =>
				col.notNull().defaultTo("[]"),
			)
			.execute();
	} catch {
		// Column already exists, ignore
	}
}
