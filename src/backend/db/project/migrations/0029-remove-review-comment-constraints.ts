import { type Kysely, sql } from "kysely";
import type { ProjectDatabase } from "../types";

export async function migrate(db: Kysely<ProjectDatabase>): Promise<void> {
	// Check if migration is already applied by inspecting the schema
	// If severity column is already nullable, skip the migration
	const tableInfo = await sql<{ name: string; notnull: number }>`
		PRAGMA table_info(review_comments)
	`.execute(db);

	const severityColumn = tableInfo.rows.find((col) => col.name === "severity");
	// If severity column exists and is already nullable (notnull = 0), migration is complete
	if (severityColumn && severityColumn.notnull === 0) {
		return;
	}

	// Check if review_comments_old exists from a failed previous run
	const oldTableResult = await sql<{ name: string }>`
		SELECT name FROM sqlite_master 
		WHERE type = 'table' AND name = 'review_comments_old'
	`.execute(db);

	if (oldTableResult.rows.length > 0) {
		await db.schema.dropTable("review_comments_old").execute();
	}

	// Disable foreign key checks during migration
	// Use try/finally to ensure foreign keys are always re-enabled
	await sql`PRAGMA foreign_keys = OFF`.execute(db);
	try {
		// Rename current table to _old
		await db.schema
			.alterTable("review_comments")
			.renameTo("review_comments_old")
			.execute();

		// Create new table with correct schema (severity and category nullable)
		await db.schema
			.createTable("review_comments")
			.addColumn("id", "text", (col) => col.primaryKey())
			.addColumn("review_card_id", "text", (col) =>
				col.notNull().references("review_cards.id"),
			)
			.addColumn("type", "text", (col) => col.notNull())
			.addColumn("file_path", "text")
			.addColumn("start_line", "integer")
			.addColumn("end_line", "integer")
			.addColumn("severity", "text")
			.addColumn("category", "text")
			.addColumn("description", "text", (col) => col.notNull())
			.addColumn("author", "text", (col) => col.notNull().defaultTo("agent"))
			.addColumn("created_at", "integer", (col) => col.notNull())
			.execute();

		// Copy data from old table
		// Type assertion needed because Kysely doesn't know about the temporary _old table
		await db
			.insertInto("review_comments")
			.columns([
				"id",
				"review_card_id",
				"type",
				"file_path",
				"start_line",
				"end_line",
				"severity",
				"category",
				"description",
				"author",
				"created_at",
			])
			.expression(
				db.selectFrom("review_comments_old" as "review_comments").selectAll(),
			)
			.execute();

		// Drop old table
		await db.schema.dropTable("review_comments_old").execute();

		// Recreate index (using ifNotExists for defensive consistency with original pattern)
		await db.schema
			.createIndex("idx_review_comments_card")
			.ifNotExists()
			.on("review_comments")
			.column("review_card_id")
			.execute();
	} finally {
		// Always re-enable foreign key checks, even if migration fails
		await sql`PRAGMA foreign_keys = ON`.execute(db);
	}
}
