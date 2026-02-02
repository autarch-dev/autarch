import type { Kysely } from "kysely";
import type { ProjectDatabase } from "../types";

export async function migrate(db: Kysely<ProjectDatabase>): Promise<void> {
	await db.schema
		.createTable("preflight_command_baselines")
		.ifNotExists()
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("workflow_id", "text", (col) =>
			col.notNull().references("workflows.id"),
		)
		.addColumn("command", "text", (col) => col.notNull())
		.addColumn("source", "text", (col) => col.notNull())
		.addColumn("stdout", "text", (col) => col.notNull())
		.addColumn("stderr", "text", (col) => col.notNull())
		.addColumn("exit_code", "integer", (col) => col.notNull())
		.addColumn("recorded_at", "integer", (col) => col.notNull())
		.execute();

	// Index for finding command baselines by workflow
	await db.schema
		.createIndex("idx_preflight_command_baselines_workflow")
		.ifNotExists()
		.on("preflight_command_baselines")
		.column("workflow_id")
		.execute();
}
