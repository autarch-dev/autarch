import type { Kysely } from "kysely";
import type { ProjectDatabase } from "../types";

export async function migrate(db: Kysely<ProjectDatabase>): Promise<void> {
	await db.schema
		.createTable("turn_thoughts")
		.ifNotExists()
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("turn_id", "text", (col) => col.notNull().references("turns.id"))
		.addColumn("thought_index", "integer", (col) => col.notNull())
		.addColumn("content", "text", (col) => col.notNull())
		.addColumn("created_at", "integer", (col) => col.notNull())
		.execute();

	await db.schema
		.createIndex("idx_turn_thoughts_turn")
		.ifNotExists()
		.on("turn_thoughts")
		.column("turn_id")
		.execute();
}
