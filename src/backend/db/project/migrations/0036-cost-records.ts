import type { Kysely } from "kysely";
import type { ProjectDatabase } from "../types";

export async function migrate(db: Kysely<ProjectDatabase>): Promise<void> {
	await db.schema
		.createTable("cost_records")
		.ifNotExists()
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("context_type", "text", (col) => col.notNull())
		.addColumn("context_id", "text", (col) => col.notNull())
		.addColumn("turn_id", "text", (col) => col.notNull())
		.addColumn("session_id", "text", (col) => col.notNull())
		.addColumn("model_id", "text", (col) => col.notNull())
		.addColumn("agent_role", "text", (col) => col.notNull())
		.addColumn("prompt_tokens", "integer", (col) => col.notNull())
		.addColumn("completion_tokens", "integer", (col) => col.notNull())
		.addColumn("cost_usd", "real", (col) => col.notNull())
		.addColumn("created_at", "integer", (col) => col.notNull())
		.execute();

	// Index for querying cost records by context (used for aggregating costs per workflow/subtask/channel)
	await db.schema
		.createIndex("idx_cost_records_context")
		.ifNotExists()
		.on("cost_records")
		.columns(["context_type", "context_id"])
		.execute();

	// Index for querying cost records by turn (used for per-turn cost lookup)
	await db.schema
		.createIndex("idx_cost_records_turn")
		.ifNotExists()
		.on("cost_records")
		.column("turn_id")
		.execute();
}
