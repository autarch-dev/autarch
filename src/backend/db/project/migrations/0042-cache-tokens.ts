import type { Kysely } from "kysely";
import type { ProjectDatabase } from "../types";

export async function migrate(db: Kysely<ProjectDatabase>): Promise<void> {
	// Add cache write and read tokens and uncached prompt tokens columns to cost records table
	try {
		await db.schema
			.alterTable("cost_records")
			.addColumn("cache_write_tokens", "integer")
			.execute();
	} catch {
		// Column already exists, ignore
	}
	try {
		await db.schema
			.alterTable("cost_records")
			.addColumn("cache_read_tokens", "integer")
			.execute();
	} catch {
		// Column already exists, ignore
	}
	try {
		await db.schema
			.alterTable("cost_records")
			.addColumn("uncached_prompt_tokens", "integer")
			.execute();
	} catch {
		// Column already exists, ignore
	}
}
