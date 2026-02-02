import type { Kysely } from "kysely";
import type { ProjectDatabase } from "../types";

export async function migrate(db: Kysely<ProjectDatabase>): Promise<void> {
	// Add base_branch column to workflows table
	try {
		await db.schema
			.alterTable("workflows")
			.addColumn("base_branch", "text")
			.execute();
	} catch {
		// Column already exists, ignore
	}
}
