import type { Kysely } from "kysely";
import type { ProjectDatabase } from "../types";

export async function migrate(db: Kysely<ProjectDatabase>): Promise<void> {
	await db.schema
		.createTable("workflows")
		.ifNotExists()
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("title", "text", (col) => col.notNull())
		.addColumn("description", "text")
		.addColumn("status", "text", (col) => col.notNull().defaultTo("backlog"))
		.addColumn("priority", "text", (col) => col.notNull().defaultTo("medium"))
		.addColumn("current_session_id", "text")
		.addColumn("awaiting_approval", "integer", (col) =>
			col.notNull().defaultTo(0),
		)
		.addColumn("pending_artifact_type", "text")
		.addColumn("created_at", "integer", (col) => col.notNull())
		.addColumn("updated_at", "integer", (col) => col.notNull())
		.execute();

	// Index for listing workflows by status
	await db.schema
		.createIndex("idx_workflows_status")
		.ifNotExists()
		.on("workflows")
		.column("status")
		.execute();
}
