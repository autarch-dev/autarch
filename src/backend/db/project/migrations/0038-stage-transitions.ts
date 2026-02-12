import type { Kysely } from "kysely";
import type { ProjectDatabase } from "../types";

export async function migrate(db: Kysely<ProjectDatabase>): Promise<void> {
	await db.schema
		.createTable("stage_transitions")
		.ifNotExists()
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("workflow_id", "text", (col) => col.notNull())
		.addColumn("previous_stage", "text", (col) => col.notNull())
		.addColumn("new_stage", "text", (col) => col.notNull())
		.addColumn("timestamp", "integer", (col) => col.notNull())
		.execute();

	// Index for querying stage transitions by workflow
	await db.schema
		.createIndex("idx_stage_transitions_workflow_id")
		.ifNotExists()
		.on("stage_transitions")
		.column("workflow_id")
		.execute();

	// Index for querying transitions by new stage over time
	await db.schema
		.createIndex("idx_stage_transitions_new_stage_timestamp")
		.ifNotExists()
		.on("stage_transitions")
		.columns(["new_stage", "timestamp"])
		.execute();

	// Index for time-based transition queries
	await db.schema
		.createIndex("idx_stage_transitions_timestamp")
		.ifNotExists()
		.on("stage_transitions")
		.column("timestamp")
		.execute();
}
