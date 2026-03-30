import type { Kysely } from "kysely";
import type { ProjectDatabase } from "../types";

export async function migrate(db: Kysely<ProjectDatabase>): Promise<void> {
	// Add pull_request_url column to workflows table
	// Stores the GitHub PR URL when a workflow is completed via "Open PR"
	try {
		await db.schema
			.alterTable("workflows")
			.addColumn("pull_request_url", "text")
			.execute();
	} catch {
		// Column already exists, ignore
	}
}
