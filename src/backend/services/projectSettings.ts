import {
	type PostWriteHooksConfig,
	PostWriteHooksConfigSchema,
} from "@/shared/schemas/hooks";
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
	POST_WRITE_HOOKS: "post_write_hooks",
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

// =============================================================================
// Post-Write Hooks
// =============================================================================

/**
 * Get the project's post-write hooks configuration.
 * Returns an empty array if no hooks are configured or if the stored data is invalid.
 */
export async function getPostWriteHooks(
	projectRoot: string,
): Promise<PostWriteHooksConfig> {
	const value = await getProjectMeta(
		projectRoot,
		PROJECT_META_KEYS.POST_WRITE_HOOKS,
	);
	if (value === null) {
		return [];
	}
	try {
		const parsed = JSON.parse(value);
		const result = PostWriteHooksConfigSchema.safeParse(parsed);
		return result.success ? result.data : [];
	} catch {
		// Invalid JSON, return empty array
		return [];
	}
}

/**
 * Set the project's post-write hooks configuration.
 * Validates the input before storing.
 */
export async function setPostWriteHooks(
	projectRoot: string,
	hooks: PostWriteHooksConfig,
): Promise<void> {
	// Validate input
	const result = PostWriteHooksConfigSchema.safeParse(hooks);
	if (!result.success) {
		throw new Error(`Invalid hooks configuration: ${result.error.message}`);
	}
	await setProjectMeta(
		projectRoot,
		PROJECT_META_KEYS.POST_WRITE_HOOKS,
		JSON.stringify(result.data),
	);
}
