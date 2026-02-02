import type { Kysely } from "kysely";
import type { ProjectDatabase } from "../types";

export async function migrate(db: Kysely<ProjectDatabase>): Promise<void> {
	await db.schema
		.createTable("turns")
		.ifNotExists()
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("session_id", "text", (col) =>
			col.notNull().references("sessions.id"),
		)
		.addColumn("turn_index", "integer", (col) => col.notNull())
		.addColumn("role", "text", (col) => col.notNull())
		.addColumn("status", "text", (col) => col.notNull().defaultTo("streaming"))
		.addColumn("token_count", "integer")
		.addColumn("hidden", "integer", (col) => col.notNull().defaultTo(0))
		.addColumn("created_at", "integer", (col) => col.notNull())
		.addColumn("completed_at", "integer")
		.execute();

	await db.schema
		.createIndex("idx_turns_session")
		.ifNotExists()
		.on("turns")
		.column("session_id")
		.execute();

	// Add hidden column to existing tables (migration for existing databases)
	try {
		await db.schema
			.alterTable("turns")
			.addColumn("hidden", "integer", (col) => col.notNull().defaultTo(0))
			.execute();
	} catch {
		// Column already exists, ignore
	}
}
