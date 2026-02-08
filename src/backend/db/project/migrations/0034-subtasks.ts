import type { Kysely } from "kysely";
import type { ProjectDatabase } from "../types";

export async function migrate(db: Kysely<ProjectDatabase>): Promise<void> {
	await db.schema
		.createTable("subtasks")
		.ifNotExists()
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("parent_session_id", "text", (col) => col.notNull())
		.addColumn("workflow_id", "text", (col) => col.notNull())
		.addColumn("task_definition", "text", (col) => col.notNull())
		.addColumn("findings", "text")
		.addColumn("status", "text", (col) => col.notNull().defaultTo("pending"))
		.addColumn("created_at", "integer", (col) => col.notNull())
		.addColumn("updated_at", "integer", (col) => col.notNull())
		.execute();

	// Index for finding subtasks by parent session
	await db.schema
		.createIndex("idx_subtasks_parent_session")
		.ifNotExists()
		.on("subtasks")
		.column("parent_session_id")
		.execute();

	// Index for finding subtasks by workflow
	await db.schema
		.createIndex("idx_subtasks_workflow")
		.ifNotExists()
		.on("subtasks")
		.column("workflow_id")
		.execute();

	// Index for finding subtasks by status
	await db.schema
		.createIndex("idx_subtasks_status")
		.ifNotExists()
		.on("subtasks")
		.column("status")
		.execute();
}
