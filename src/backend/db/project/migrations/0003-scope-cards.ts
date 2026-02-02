import type { Kysely } from "kysely";
import type { ProjectDatabase } from "../types";

export async function migrate(db: Kysely<ProjectDatabase>): Promise<void> {
	await db.schema
		.createTable("scope_cards")
		.ifNotExists()
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("workflow_id", "text", (col) =>
			col.notNull().references("workflows.id"),
		)
		.addColumn("title", "text", (col) => col.notNull())
		.addColumn("description", "text", (col) => col.notNull())
		.addColumn("in_scope_json", "text", (col) => col.notNull())
		.addColumn("out_of_scope_json", "text", (col) => col.notNull())
		.addColumn("constraints_json", "text")
		.addColumn("recommended_path", "text", (col) => col.notNull())
		.addColumn("rationale", "text")
		.addColumn("created_at", "integer", (col) => col.notNull())
		.execute();

	await db.schema
		.createIndex("idx_scope_cards_workflow")
		.ifNotExists()
		.on("scope_cards")
		.column("workflow_id")
		.execute();
}
