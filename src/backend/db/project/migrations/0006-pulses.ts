import type { Kysely } from "kysely";
import type { ProjectDatabase } from "../types";

export async function migrate(db: Kysely<ProjectDatabase>): Promise<void> {
	await db.schema
		.createTable("pulses")
		.ifNotExists()
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("workflow_id", "text", (col) =>
			col.notNull().references("workflows.id"),
		)
		.addColumn("planned_pulse_id", "text")
		.addColumn("status", "text", (col) => col.notNull().defaultTo("proposed"))
		.addColumn("description", "text")
		.addColumn("pulse_branch", "text")
		.addColumn("worktree_path", "text")
		.addColumn("checkpoint_commit_sha", "text")
		.addColumn("diff_artifact_id", "text")
		.addColumn("has_unresolved_issues", "integer", (col) =>
			col.notNull().defaultTo(0),
		)
		.addColumn("is_recovery_checkpoint", "integer", (col) =>
			col.notNull().defaultTo(0),
		)
		.addColumn("rejection_count", "integer", (col) =>
			col.notNull().defaultTo(0),
		)
		.addColumn("created_at", "integer", (col) => col.notNull())
		.addColumn("started_at", "integer")
		.addColumn("ended_at", "integer")
		.addColumn("failure_reason", "text")
		.execute();

	// Index for finding pulses by workflow
	await db.schema
		.createIndex("idx_pulses_workflow")
		.ifNotExists()
		.on("pulses")
		.column("workflow_id")
		.execute();

	// Index for finding pulses by status
	await db.schema
		.createIndex("idx_pulses_status")
		.ifNotExists()
		.on("pulses")
		.column("status")
		.execute();
}
