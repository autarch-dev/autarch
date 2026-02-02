import type { Kysely } from "kysely";
import type { ProjectDatabase } from "../types";

export async function migrate(db: Kysely<ProjectDatabase>): Promise<void> {
	await db.schema
		.createTable("review_cards")
		.ifNotExists()
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("workflow_id", "text", (col) =>
			col.notNull().references("workflows.id"),
		)
		.addColumn("recommendation", "text") // approve, deny, manual_review - nullable until completeReview
		.addColumn("summary", "text") // Nullable until completeReview
		.addColumn("status", "text", (col) => col.notNull().defaultTo("pending"))
		.addColumn("created_at", "integer", (col) => col.notNull())
		.execute();

	await db.schema
		.createIndex("idx_review_cards_workflow")
		.ifNotExists()
		.on("review_cards")
		.column("workflow_id")
		.execute();
}
