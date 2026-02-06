import type { Kysely } from "kysely";
import type { ProjectDatabase } from "../types";

export async function migrate(db: Kysely<ProjectDatabase>): Promise<void> {
	await db.schema
		.createTable("roadmaps")
		.ifNotExists()
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("title", "text", (col) => col.notNull())
		.addColumn("description", "text")
		.addColumn("status", "text", (col) => col.notNull().defaultTo("draft"))
		.addColumn("current_session_id", "text")
		.addColumn("created_at", "integer", (col) => col.notNull())
		.addColumn("updated_at", "integer", (col) => col.notNull())
		.execute();

	await db.schema
		.createTable("milestones")
		.ifNotExists()
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("roadmap_id", "text", (col) =>
			col.notNull().references("roadmaps.id"),
		)
		.addColumn("title", "text", (col) => col.notNull())
		.addColumn("description", "text")
		.addColumn("start_date", "integer")
		.addColumn("end_date", "integer")
		.addColumn("sort_order", "integer", (col) => col.notNull().defaultTo(0))
		.addColumn("created_at", "integer", (col) => col.notNull())
		.addColumn("updated_at", "integer", (col) => col.notNull())
		.execute();

	await db.schema
		.createIndex("idx_milestones_roadmap")
		.ifNotExists()
		.on("milestones")
		.column("roadmap_id")
		.execute();

	await db.schema
		.createTable("initiatives")
		.ifNotExists()
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("milestone_id", "text", (col) =>
			col.notNull().references("milestones.id"),
		)
		.addColumn("roadmap_id", "text", (col) =>
			col.notNull().references("roadmaps.id"),
		)
		.addColumn("title", "text", (col) => col.notNull())
		.addColumn("description", "text")
		.addColumn("status", "text", (col) =>
			col.notNull().defaultTo("not_started"),
		)
		.addColumn("priority", "text", (col) => col.notNull().defaultTo("medium"))
		.addColumn("progress", "integer", (col) => col.notNull().defaultTo(0))
		.addColumn("progress_mode", "text", (col) =>
			col.notNull().defaultTo("manual"),
		)
		.addColumn("workflow_id", "text")
		.addColumn("sort_order", "integer", (col) => col.notNull().defaultTo(0))
		.addColumn("created_at", "integer", (col) => col.notNull())
		.addColumn("updated_at", "integer", (col) => col.notNull())
		.execute();

	await db.schema
		.createIndex("idx_initiatives_milestone")
		.ifNotExists()
		.on("initiatives")
		.column("milestone_id")
		.execute();

	await db.schema
		.createIndex("idx_initiatives_roadmap")
		.ifNotExists()
		.on("initiatives")
		.column("roadmap_id")
		.execute();

	await db.schema
		.createTable("vision_documents")
		.ifNotExists()
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("roadmap_id", "text", (col) =>
			col.notNull().references("roadmaps.id").unique(),
		)
		.addColumn("content", "text", (col) => col.notNull().defaultTo(""))
		.addColumn("created_at", "integer", (col) => col.notNull())
		.addColumn("updated_at", "integer", (col) => col.notNull())
		.execute();

	await db.schema
		.createTable("dependencies")
		.ifNotExists()
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("source_type", "text", (col) => col.notNull())
		.addColumn("source_id", "text", (col) => col.notNull())
		.addColumn("target_type", "text", (col) => col.notNull())
		.addColumn("target_id", "text", (col) => col.notNull())
		.addColumn("created_at", "integer", (col) => col.notNull())
		.execute();

	await db.schema
		.createIndex("idx_dependencies_source")
		.ifNotExists()
		.on("dependencies")
		.columns(["source_type", "source_id"])
		.execute();

	await db.schema
		.createIndex("idx_dependencies_target")
		.ifNotExists()
		.on("dependencies")
		.columns(["target_type", "target_id"])
		.execute();
}
