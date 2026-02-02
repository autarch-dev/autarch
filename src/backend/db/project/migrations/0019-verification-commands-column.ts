import type { Kysely } from "kysely";
import type { ProjectDatabase } from "../types";

export async function migrate(db: Kysely<ProjectDatabase>): Promise<void> {
	// Add verification_commands column to preflight_setup
	// Stores JSON array of command strings (serialized with JSON.stringify)
	try {
		await db.schema
			.alterTable("preflight_setup")
			.addColumn("verification_commands", "text")
			.execute();
	} catch {
		// Column already exists, ignore
	}
}
