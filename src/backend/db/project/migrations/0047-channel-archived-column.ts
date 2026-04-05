import type { Kysely } from "kysely";
import type { ProjectDatabase } from "../types";

export async function migrate(db: Kysely<ProjectDatabase>): Promise<void> {
	// Add archived column to channels table
	try {
		await db.schema
			.alterTable("channels")
			.addColumn("archived", "integer", (col) => col.notNull().defaultTo(0))
			.execute();
	} catch {
		// Column already exists, ignore
	}
}
