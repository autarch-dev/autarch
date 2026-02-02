import type { Kysely } from "kysely";
import type { ProjectDatabase } from "../types";

export async function migrate(db: Kysely<ProjectDatabase>): Promise<void> {
	// Add turn_id column to scope_cards
	try {
		await db.schema
			.alterTable("scope_cards")
			.addColumn("turn_id", "text")
			.execute();
	} catch {
		// Column already exists, ignore
	}

	// Add turn_id column to research_cards
	try {
		await db.schema
			.alterTable("research_cards")
			.addColumn("turn_id", "text")
			.execute();
	} catch {
		// Column already exists, ignore
	}

	// Add turn_id column to plans
	try {
		await db.schema.alterTable("plans").addColumn("turn_id", "text").execute();
	} catch {
		// Column already exists, ignore
	}

	// Add turn_id column to review_cards
	try {
		await db.schema
			.alterTable("review_cards")
			.addColumn("turn_id", "text")
			.execute();
	} catch {
		// Column already exists, ignore
	}
}
