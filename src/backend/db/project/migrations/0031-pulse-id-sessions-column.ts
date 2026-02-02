import type { Kysely } from "kysely";
import type { ProjectDatabase } from "../types";

export async function migrate(db: Kysely<ProjectDatabase>): Promise<void> {
	// Add pulse_id column to sessions table
	// Links execution sessions to their associated pulse for grouping messages
	try {
		await db.schema
			.alterTable("sessions")
			.addColumn("pulse_id", "text")
			.execute();
	} catch {
		// Column already exists, ignore
	}
}
