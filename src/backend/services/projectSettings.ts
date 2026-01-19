import {
	type MergeStrategy,
	MergeStrategySchema,
} from "@/shared/schemas/workflow";
import { getProjectDb } from "../db/project";

// =============================================================================
// Project Meta Keys
// =============================================================================

export const PROJECT_META_KEYS = {
	MERGE_STRATEGY: "merge_strategy",
} as const;

// =============================================================================
// Low-Level Helpers
// =============================================================================

/**
 * Get a project meta value by key.
 */
export async function getProjectMeta(
	projectRoot: string,
	key: string,
): Promise<string | null> {
	const db = await getProjectDb(projectRoot);
	const result = await db
		.selectFrom("project_meta")
		.select("value")
		.where("key", "=", key)
		.executeTakeFirst();
	return result?.value ?? null;
}

/**
 * Set a project meta value by key (upsert pattern).
 */
export async function setProjectMeta(
	projectRoot: string,
	key: string,
	value: string,
): Promise<void> {
	const db = await getProjectDb(projectRoot);
	await db
		.insertInto("project_meta")
		.values({
			key,
			value,
			updated_at: Date.now(),
		})
		.onConflict((oc) =>
			oc.column("key").doUpdateSet({
				value,
				updated_at: Date.now(),
			}),
		)
		.execute();
}

// =============================================================================
// Merge Strategy
// =============================================================================

/**
 * Get the project's default merge strategy.
 */
export async function getMergeStrategy(
	projectRoot: string,
): Promise<MergeStrategy | null> {
	const value = await getProjectMeta(
		projectRoot,
		PROJECT_META_KEYS.MERGE_STRATEGY,
	);
	if (value === null) {
		return null;
	}
	// Validate the stored value against the schema
	const parsed = MergeStrategySchema.safeParse(value);
	return parsed.success ? parsed.data : null;
}

/**
 * Set the project's default merge strategy.
 */
export async function setMergeStrategy(
	projectRoot: string,
	strategy: MergeStrategy,
): Promise<void> {
	await setProjectMeta(projectRoot, PROJECT_META_KEYS.MERGE_STRATEGY, strategy);
}
