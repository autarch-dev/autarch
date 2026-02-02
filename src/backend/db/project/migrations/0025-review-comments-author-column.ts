import type { Kysely } from "kysely";
import type { ProjectDatabase } from "../types";

export async function migrate(db: Kysely<ProjectDatabase>): Promise<void> {
	// Add author column to review_comments (default to 'agent' for existing comments)
	try {
		await db.schema
			.alterTable("review_comments")
			.addColumn("author", "text", (col) => col.notNull().defaultTo("agent"))
			.execute();
	} catch {
		// Column already exists, ignore
	}

	// Note: severity and category are already nullable in createReviewCommentsTable.
	// This comment is for historical context only. A later migration
	// (removeReviewCommentConstraints) removes NOT NULL constraints that may exist
	// in older databases.
}
