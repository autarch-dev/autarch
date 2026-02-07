import type { Kysely } from "kysely";
import type { ProjectDatabase } from "../types";

export async function migrate(db: Kysely<ProjectDatabase>): Promise<void> {
	// Add size column to initiatives table
	try {
		await db.schema
			.alterTable("initiatives")
			.addColumn("size", "integer")
			.execute();
	} catch {
		// Column already exists, ignore
	}

	// Set all initiatives to auto progress mode
	await db
		.updateTable("initiatives")
		.set({ progress_mode: "auto" })
		.where("progress_mode", "!=", "auto")
		.execute();
}
