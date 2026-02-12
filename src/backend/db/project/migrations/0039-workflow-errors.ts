import type { Kysely } from "kysely";
import type { ProjectDatabase } from "../types";

export async function migrate(db: Kysely<ProjectDatabase>): Promise<void> {
	await db.schema
		.createTable("workflow_errors")
		.ifNotExists()
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("workflow_id", "text", (col) => col.notNull())
		.addColumn("stage", "text", (col) => col.notNull())
		.addColumn("error_type", "text", (col) =>
			col.notNull().defaultTo("workflow_error"),
		)
		.addColumn("error_message", "text", (col) => col.notNull())
		.addColumn("timestamp", "integer", (col) => col.notNull())
		.execute();

	// Index for querying errors by workflow
	await db.schema
		.createIndex("idx_workflow_errors_workflow_id")
		.ifNotExists()
		.on("workflow_errors")
		.column("workflow_id")
		.execute();

	// Index for querying errors by stage over time
	await db.schema
		.createIndex("idx_workflow_errors_stage_timestamp")
		.ifNotExists()
		.on("workflow_errors")
		.columns(["stage", "timestamp"])
		.execute();

	// Index for querying errors by type over time
	await db.schema
		.createIndex("idx_workflow_errors_error_type_timestamp")
		.ifNotExists()
		.on("workflow_errors")
		.columns(["error_type", "timestamp"])
		.execute();
}
