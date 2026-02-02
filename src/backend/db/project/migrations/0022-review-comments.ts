import type { Kysely } from "kysely";
import type { ProjectDatabase } from "../types";

export async function migrate(db: Kysely<ProjectDatabase>): Promise<void> {
	await db.schema
		.createTable("review_comments")
		.ifNotExists()
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("review_card_id", "text", (col) =>
			col.notNull().references("review_cards.id"),
		)
		.addColumn("type", "text", (col) => col.notNull()) // line, file, review
		.addColumn("file_path", "text") // Nullable for review-level comments
		.addColumn("start_line", "integer") // Nullable for file/review-level comments
		.addColumn("end_line", "integer") // Nullable (optional even for line comments)
		.addColumn("severity", "text") // High, Medium, Low - nullable for user comments
		.addColumn("category", "text") // Nullable for user comments
		.addColumn("description", "text", (col) => col.notNull())
		.addColumn("author", "text", (col) => col.notNull().defaultTo("agent")) // agent or user
		.addColumn("created_at", "integer", (col) => col.notNull())
		.execute();

	// Index for finding comments by review card
	await db.schema
		.createIndex("idx_review_comments_card")
		.ifNotExists()
		.on("review_comments")
		.column("review_card_id")
		.execute();
}
