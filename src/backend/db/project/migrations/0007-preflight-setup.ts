import type { Kysely } from "kysely";
import type { ProjectDatabase } from "../types";

export async function migrate(db: Kysely<ProjectDatabase>): Promise<void> {
	await db.schema
		.createTable("preflight_setup")
		.ifNotExists()
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("workflow_id", "text", (col) =>
			col.notNull().references("workflows.id"),
		)
		.addColumn("session_id", "text")
		.addColumn("status", "text", (col) => col.notNull().defaultTo("running"))
		.addColumn("progress_message", "text")
		.addColumn("error_message", "text")
		.addColumn("created_at", "integer", (col) => col.notNull())
		.addColumn("completed_at", "integer")
		.execute();

	// Index for finding preflight by workflow
	await db.schema
		.createIndex("idx_preflight_setup_workflow")
		.ifNotExists()
		.on("preflight_setup")
		.column("workflow_id")
		.execute();
}
