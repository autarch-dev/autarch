import type { Kysely } from "kysely";
import type { ProjectDatabase } from "../types";

export async function migrate(db: Kysely<ProjectDatabase>): Promise<void> {
	// Add perspective column to roadmaps table
	try {
		await db.schema
			.alterTable("roadmaps")
			.addColumn("perspective", "text", (col) =>
				col.notNull().defaultTo("balanced"),
			)
			.execute();
	} catch {
		// Column already exists, ignore
	}
}
