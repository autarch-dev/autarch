import type { Kysely } from "kysely";
import type { ProjectDatabase } from "../types";

export async function migrate(db: Kysely<ProjectDatabase>): Promise<void> {
	await db.schema
		.createTable("questions")
		.ifNotExists()
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("session_id", "text", (col) =>
			col.notNull().references("sessions.id"),
		)
		.addColumn("turn_id", "text", (col) => col.notNull().references("turns.id"))
		.addColumn("question_index", "integer", (col) => col.notNull())
		.addColumn("type", "text", (col) => col.notNull())
		.addColumn("prompt", "text", (col) => col.notNull())
		.addColumn("options_json", "text")
		.addColumn("answer_json", "text")
		.addColumn("status", "text", (col) => col.notNull().defaultTo("pending"))
		.addColumn("created_at", "integer", (col) => col.notNull())
		.addColumn("answered_at", "integer")
		.execute();

	// Index for querying questions by turn
	await db.schema
		.createIndex("idx_questions_turn")
		.ifNotExists()
		.on("questions")
		.column("turn_id")
		.execute();

	// Index for querying questions by session
	await db.schema
		.createIndex("idx_questions_session")
		.ifNotExists()
		.on("questions")
		.column("session_id")
		.execute();

	// Index for finding pending questions
	await db.schema
		.createIndex("idx_questions_status")
		.ifNotExists()
		.on("questions")
		.column("status")
		.execute();
}
