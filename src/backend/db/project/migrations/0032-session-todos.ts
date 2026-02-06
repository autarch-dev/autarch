import type { Kysely } from "kysely";
import type { ProjectDatabase } from "../types";

export async function migrate(db: Kysely<ProjectDatabase>): Promise<void> {
	await db.schema
		.createTable("session_todos")
		.ifNotExists()
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("session_id", "text", (col) =>
			col.notNull().references("sessions.id"),
		)
		.addColumn("context_type", "text", (col) => col.notNull())
		.addColumn("context_id", "text", (col) => col.notNull())
		.addColumn("title", "text", (col) => col.notNull())
		.addColumn("description", "text", (col) => col.notNull().defaultTo(""))
		.addColumn("checked", "integer", (col) => col.notNull().defaultTo(0))
		.addColumn("sort_order", "integer", (col) => col.notNull())
		.addColumn("created_at", "integer", (col) => col.notNull())
		.execute();

	// Index for querying todos by session (used for workflows - todos per stage)
	await db.schema
		.createIndex("idx_session_todos_session")
		.ifNotExists()
		.on("session_todos")
		.column("session_id")
		.execute();

	// Index for querying todos by context (used for channels - todos persist across channel)
	await db.schema
		.createIndex("idx_session_todos_context")
		.ifNotExists()
		.on("session_todos")
		.columns(["context_type", "context_id"])
		.execute();
}
