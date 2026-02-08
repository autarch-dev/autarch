import type { Kysely } from "kysely";
import type { ProjectDatabase } from "../types";

export async function migrate(db: Kysely<ProjectDatabase>): Promise<void> {
	// Add parent_session_id column to sessions table
	// Links subagent sessions back to their coordinator session
	try {
		await db.schema
			.alterTable("sessions")
			.addColumn("parent_session_id", "text")
			.execute();
	} catch {
		// Column already exists, ignore
	}
}
