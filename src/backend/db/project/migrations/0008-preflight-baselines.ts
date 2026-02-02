import type { Kysely } from "kysely";
import type { ProjectDatabase } from "../types";

export async function migrate(db: Kysely<ProjectDatabase>): Promise<void> {
	await db.schema
		.createTable("preflight_baselines")
		.ifNotExists()
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("workflow_id", "text", (col) =>
			col.notNull().references("workflows.id"),
		)
		.addColumn("issue_type", "text", (col) => col.notNull())
		.addColumn("source", "text", (col) => col.notNull())
		.addColumn("pattern", "text", (col) => col.notNull())
		.addColumn("file_path", "text")
		.addColumn("description", "text")
		.addColumn("recorded_at", "integer", (col) => col.notNull())
		.execute();

	// Index for finding baselines by workflow
	await db.schema
		.createIndex("idx_preflight_baselines_workflow")
		.ifNotExists()
		.on("preflight_baselines")
		.column("workflow_id")
		.execute();
}
