import type { Kysely } from "kysely";
import type { ProjectDatabase } from "../types";

export async function migrate(db: Kysely<ProjectDatabase>): Promise<void> {
	await db.schema
		.createTable("research_cards")
		.ifNotExists()
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("workflow_id", "text", (col) =>
			col.notNull().references("workflows.id"),
		)
		.addColumn("summary", "text", (col) => col.notNull())
		.addColumn("key_files_json", "text", (col) => col.notNull())
		.addColumn("patterns_json", "text")
		.addColumn("dependencies_json", "text")
		.addColumn("integration_points_json", "text")
		.addColumn("challenges_json", "text")
		.addColumn("recommendations_json", "text", (col) => col.notNull())
		.addColumn("created_at", "integer", (col) => col.notNull())
		.execute();

	await db.schema
		.createIndex("idx_research_cards_workflow")
		.ifNotExists()
		.on("research_cards")
		.column("workflow_id")
		.execute();
}
