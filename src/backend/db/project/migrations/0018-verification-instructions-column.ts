import type { Kysely } from "kysely";
import type { ProjectDatabase } from "../types";

export async function migrate(db: Kysely<ProjectDatabase>): Promise<void> {
	// Add verification_instructions column to preflight_setup
	try {
		await db.schema
			.alterTable("preflight_setup")
			.addColumn("verification_instructions", "text")
			.execute();
	} catch {
		// Column already exists, ignore
	}
}
