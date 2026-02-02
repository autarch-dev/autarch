import type { Kysely } from "kysely";
import type { ProjectDatabase } from "../types";

export async function migrate(db: Kysely<ProjectDatabase>): Promise<void> {
	// Add prompt_tokens column to turns
	try {
		await db.schema
			.alterTable("turns")
			.addColumn("prompt_tokens", "integer")
			.execute();
	} catch {
		// Column already exists, ignore
	}

	// Add completion_tokens column to turns
	try {
		await db.schema
			.alterTable("turns")
			.addColumn("completion_tokens", "integer")
			.execute();
	} catch {
		// Column already exists, ignore
	}

	// Add model_id column to turns
	try {
		await db.schema.alterTable("turns").addColumn("model_id", "text").execute();
	} catch {
		// Column already exists, ignore
	}
}
