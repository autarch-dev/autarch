import type { Kysely } from "kysely";
import type { ProjectDatabase } from "../types";

export async function migrate(db: Kysely<ProjectDatabase>): Promise<void> {
	await db.schema
		.createTable("persona_roadmaps")
		.ifNotExists()
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("roadmap_id", "text", (col) => col.notNull())
		.addColumn("persona", "text", (col) => col.notNull())
		.addColumn("session_id", "text")
		.addColumn("roadmap_data", "text")
		.addColumn("status", "text", (col) => col.notNull().defaultTo("pending"))
		.addColumn("created_at", "integer", (col) => col.notNull())
		.addColumn("updated_at", "integer", (col) => col.notNull())
		.execute();

	// Unique index ensuring one persona per roadmap
	await db.schema
		.createIndex("idx_persona_roadmaps_roadmap_persona")
		.ifNotExists()
		.on("persona_roadmaps")
		.columns(["roadmap_id", "persona"])
		.unique()
		.execute();

	// Index for finding persona roadmaps by roadmap
	await db.schema
		.createIndex("idx_persona_roadmaps_roadmap")
		.ifNotExists()
		.on("persona_roadmaps")
		.column("roadmap_id")
		.execute();
}
