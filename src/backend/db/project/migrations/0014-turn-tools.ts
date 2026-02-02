import type { Kysely } from "kysely";
import type { ProjectDatabase } from "../types";

export async function migrate(db: Kysely<ProjectDatabase>): Promise<void> {
	await db.schema
		.createTable("turn_tools")
		.ifNotExists()
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("turn_id", "text", (col) => col.notNull().references("turns.id"))
		.addColumn("tool_index", "integer", (col) => col.notNull())
		.addColumn("tool_name", "text", (col) => col.notNull())
		.addColumn("reason", "text")
		.addColumn("input_json", "text", (col) => col.notNull())
		.addColumn("output_json", "text")
		.addColumn("status", "text", (col) => col.notNull().defaultTo("pending"))
		.addColumn("started_at", "integer", (col) => col.notNull())
		.addColumn("completed_at", "integer")
		.execute();

	await db.schema
		.createIndex("idx_turn_tools_turn")
		.ifNotExists()
		.on("turn_tools")
		.column("turn_id")
		.execute();
}
