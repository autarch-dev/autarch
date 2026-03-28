import type { Kysely } from "kysely";
import type { ProjectDatabase } from "../types";

export async function migrate(db: Kysely<ProjectDatabase>): Promise<void> {
	try {
		await db.schema
			.alterTable("pulses")
			.addColumn("jira_issue_id", "text")
			.execute();
	} catch {
		// Column already exists, ignore
	}
}
