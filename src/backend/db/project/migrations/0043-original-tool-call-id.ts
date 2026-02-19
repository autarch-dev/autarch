import type { Kysely } from "kysely";
import type { ProjectDatabase } from "../types";

export async function migrate(db: Kysely<ProjectDatabase>): Promise<void> {
	// Add original_tool_id column to turn_tools table
	try {
		await db.schema
			.alterTable("turn_tools")
			.addColumn("original_tool_id", "text")
			.execute();
	} catch {
		// Column already exists, ignore
	}
}
