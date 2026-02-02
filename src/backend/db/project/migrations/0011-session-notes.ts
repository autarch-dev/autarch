import type { Kysely } from "kysely";
import type { ProjectDatabase } from "../types";

export async function migrate(db: Kysely<ProjectDatabase>): Promise<void> {
	await db.schema
		.createTable("session_notes")
		.ifNotExists()
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("session_id", "text", (col) =>
			col.notNull().references("sessions.id"),
		)
		.addColumn("context_type", "text", (col) => col.notNull())
		.addColumn("context_id", "text", (col) => col.notNull())
		.addColumn("content", "text", (col) => col.notNull())
		.addColumn("created_at", "integer", (col) => col.notNull())
		.execute();

	// Index for querying notes by session (used for workflows - notes per stage)
	await db.schema
		.createIndex("idx_session_notes_session")
		.ifNotExists()
		.on("session_notes")
		.column("session_id")
		.execute();

	// Index for querying notes by context (used for channels - notes persist across channel)
	await db.schema
		.createIndex("idx_session_notes_context")
		.ifNotExists()
		.on("session_notes")
		.columns(["context_type", "context_id"])
		.execute();
}
