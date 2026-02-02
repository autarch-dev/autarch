import type { Kysely } from "kysely";
import type { ProjectDatabase } from "../types";

export async function migrate(db: Kysely<ProjectDatabase>): Promise<void> {
	await db.schema
		.createTable("sessions")
		.ifNotExists()
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("context_type", "text", (col) => col.notNull())
		.addColumn("context_id", "text", (col) => col.notNull())
		.addColumn("agent_role", "text", (col) => col.notNull())
		.addColumn("status", "text", (col) => col.notNull().defaultTo("active"))
		.addColumn("created_at", "integer", (col) => col.notNull())
		.addColumn("updated_at", "integer", (col) => col.notNull())
		.execute();

	// Index for finding sessions by context
	await db.schema
		.createIndex("idx_sessions_context")
		.ifNotExists()
		.on("sessions")
		.columns(["context_type", "context_id"])
		.execute();

	// Index for finding active sessions
	await db.schema
		.createIndex("idx_sessions_status")
		.ifNotExists()
		.on("sessions")
		.column("status")
		.execute();
}
