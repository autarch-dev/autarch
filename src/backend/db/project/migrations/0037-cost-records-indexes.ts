import type { Kysely } from "kysely";
import type { ProjectDatabase } from "../types";

export async function migrate(db: Kysely<ProjectDatabase>): Promise<void> {
	// Index for aggregating costs by model
	await db.schema
		.createIndex("idx_cost_records_model_id")
		.ifNotExists()
		.on("cost_records")
		.column("model_id")
		.execute();

	// Index for aggregating costs by agent role
	await db.schema
		.createIndex("idx_cost_records_agent_role")
		.ifNotExists()
		.on("cost_records")
		.column("agent_role")
		.execute();

	// Index for time-based cost trend queries
	await db.schema
		.createIndex("idx_cost_records_created_at")
		.ifNotExists()
		.on("cost_records")
		.column("created_at")
		.execute();

	// Index for querying cost records by context (context_type + context_id)
	await db.schema
		.createIndex("idx_cost_records_context")
		.ifNotExists()
		.on("cost_records")
		.columns(["context_type", "context_id"])
		.execute();
}
