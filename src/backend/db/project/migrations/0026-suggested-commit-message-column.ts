import type { Kysely } from "kysely";
import type { ProjectDatabase } from "../types";

export async function migrate(db: Kysely<ProjectDatabase>): Promise<void> {
	// Add suggested_commit_message column to review_cards table
	try {
		await db.schema
			.alterTable("review_cards")
			.addColumn("suggested_commit_message", "text")
			.execute();
	} catch {
		// Column already exists, ignore
	}
}
