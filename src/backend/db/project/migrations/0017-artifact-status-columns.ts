import type { Kysely } from "kysely";
import type { ProjectDatabase } from "../types";

export async function migrate(db: Kysely<ProjectDatabase>): Promise<void> {
	// Add status column to scope_cards
	try {
		await db.schema
			.alterTable("scope_cards")
			.addColumn("status", "text", (col) => col.notNull().defaultTo("pending"))
			.execute();
	} catch {
		// Column already exists, ignore
	}

	// Add status column to research_cards
	try {
		await db.schema
			.alterTable("research_cards")
			.addColumn("status", "text", (col) => col.notNull().defaultTo("pending"))
			.execute();
	} catch {
		// Column already exists, ignore
	}

	// Add status column to plans
	try {
		await db.schema
			.alterTable("plans")
			.addColumn("status", "text", (col) => col.notNull().defaultTo("pending"))
			.execute();
	} catch {
		// Column already exists, ignore
	}
}
