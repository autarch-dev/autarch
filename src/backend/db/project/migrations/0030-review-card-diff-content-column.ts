import type { Kysely } from "kysely";
import type { ProjectDatabase } from "../types";

export async function migrate(db: Kysely<ProjectDatabase>): Promise<void> {
	// Add diff_content column to review_cards table
	// Stores the persisted diff content when a review is approved
	try {
		await db.schema
			.alterTable("review_cards")
			.addColumn("diff_content", "text")
			.execute();
	} catch {
		// Column already exists, ignore
	}
}
