import type { Kysely } from "kysely";
import type { ProjectDatabase } from "../types";

export async function migrate(db: Kysely<ProjectDatabase>): Promise<void> {
	// Add Jira sync columns to workflows
	for (const col of [
		"jira_issue_key",
		"jira_issue_id",
		"jira_sync_status",
		"jira_sync_error",
	]) {
		try {
			await db.schema.alterTable("workflows").addColumn(col, "text").execute();
		} catch {
			// Column already exists, ignore
		}
	}
	try {
		await db.schema
			.alterTable("workflows")
			.addColumn("jira_synced_at", "integer")
			.execute();
	} catch {
		// Column already exists, ignore
	}

	// Add Jira sync columns to milestones
	for (const col of [
		"jira_epic_key",
		"jira_epic_id",
		"jira_sync_status",
		"jira_sync_error",
	]) {
		try {
			await db.schema.alterTable("milestones").addColumn(col, "text").execute();
		} catch {
			// Column already exists, ignore
		}
	}
	try {
		await db.schema
			.alterTable("milestones")
			.addColumn("jira_synced_at", "integer")
			.execute();
	} catch {
		// Column already exists, ignore
	}

	// Add Jira sync columns to initiatives
	for (const col of [
		"jira_issue_key",
		"jira_issue_id",
		"jira_sync_status",
		"jira_sync_error",
	]) {
		try {
			await db.schema
				.alterTable("initiatives")
				.addColumn(col, "text")
				.execute();
		} catch {
			// Column already exists, ignore
		}
	}
	try {
		await db.schema
			.alterTable("initiatives")
			.addColumn("jira_synced_at", "integer")
			.execute();
	} catch {
		// Column already exists, ignore
	}
}
