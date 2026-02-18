import type {
	CustomModel,
	CustomProvider,
} from "@/shared/schemas/custom-providers";
import { getGlobalDb } from "../db/global";

// =============================================================================
// Low-Level Setting Helpers (reused for custom provider API keys)
// =============================================================================

function apiKeySettingKey(providerId: string): string {
	return `api_key_custom_${providerId}`;
}

async function getSetting(key: string): Promise<string | null> {
	const db = await getGlobalDb();
	const result = await db
		.selectFrom("settings")
		.select("value")
		.where("key", "=", key)
		.executeTakeFirst();
	return result?.value ?? null;
}

async function setSetting(key: string, value: string): Promise<void> {
	const db = await getGlobalDb();
	await db
		.insertInto("settings")
		.values({ key, value, updated_at: Date.now() })
		.onConflict((oc) =>
			oc.column("key").doUpdateSet({ value, updated_at: Date.now() }),
		)
		.execute();
}

async function deleteSetting(key: string): Promise<void> {
	const db = await getGlobalDb();
	await db.deleteFrom("settings").where("key", "=", key).execute();
}

// =============================================================================
// Custom Provider CRUD
// =============================================================================

export async function getCustomProviders(): Promise<CustomProvider[]> {
	const db = await getGlobalDb();
	const rows = await db
		.selectFrom("custom_providers")
		.selectAll()
		.orderBy("label", "asc")
		.execute();

	return rows.map(rowToProvider);
}

export async function getCustomProvider(
	id: string,
): Promise<CustomProvider | null> {
	const db = await getGlobalDb();
	const row = await db
		.selectFrom("custom_providers")
		.selectAll()
		.where("id", "=", id)
		.executeTakeFirst();

	return row ? rowToProvider(row) : null;
}

export async function createCustomProvider(
	provider: CustomProvider,
): Promise<void> {
	const db = await getGlobalDb();
	const now = Date.now();
	await db
		.insertInto("custom_providers")
		.values({
			id: provider.id,
			label: provider.label,
			base_url: provider.baseUrl,
			headers_json: provider.headersJson
				? JSON.stringify(provider.headersJson)
				: null,
			created_at: now,
			updated_at: now,
		})
		.execute();
}

export async function updateCustomProvider(
	id: string,
	updates: Partial<Omit<CustomProvider, "id">>,
): Promise<void> {
	const db = await getGlobalDb();
	const updateObj: Record<string, unknown> = { updated_at: Date.now() };

	if (updates.label !== undefined) updateObj.label = updates.label;
	if (updates.baseUrl !== undefined) updateObj.base_url = updates.baseUrl;
	if (updates.headersJson !== undefined) {
		updateObj.headers_json = updates.headersJson
			? JSON.stringify(updates.headersJson)
			: null;
	}

	await db
		.updateTable("custom_providers")
		.set(updateObj)
		.where("id", "=", id)
		.execute();
}

export async function deleteCustomProvider(id: string): Promise<void> {
	const db = await getGlobalDb();

	// Delete child models first (FK constraint)
	await db.deleteFrom("custom_models").where("provider_id", "=", id).execute();
	await db.deleteFrom("custom_providers").where("id", "=", id).execute();

	// Clean up the API key
	await deleteSetting(apiKeySettingKey(id));
}

// =============================================================================
// Custom Model CRUD
// =============================================================================

export async function getCustomModels(
	providerId?: string,
): Promise<CustomModel[]> {
	const db = await getGlobalDb();
	let query = db
		.selectFrom("custom_models")
		.selectAll()
		.orderBy("label", "asc");

	if (providerId) {
		query = query.where("provider_id", "=", providerId);
	}

	const rows = await query.execute();
	return rows.map(rowToModel);
}

export async function getCustomModel(id: string): Promise<CustomModel | null> {
	const db = await getGlobalDb();
	const row = await db
		.selectFrom("custom_models")
		.selectAll()
		.where("id", "=", id)
		.executeTakeFirst();

	return row ? rowToModel(row) : null;
}

export async function getCustomModelByCompositeId(
	providerId: string,
	modelName: string,
): Promise<CustomModel | null> {
	const db = await getGlobalDb();
	const row = await db
		.selectFrom("custom_models")
		.selectAll()
		.where("provider_id", "=", providerId)
		.where("model_name", "=", modelName)
		.executeTakeFirst();

	return row ? rowToModel(row) : null;
}

export async function createCustomModel(
	providerId: string,
	model: Omit<CustomModel, "id" | "providerId">,
): Promise<CustomModel> {
	const db = await getGlobalDb();
	const now = Date.now();
	const id = `${providerId}/${model.modelName}`;

	await db
		.insertInto("custom_models")
		.values({
			id,
			provider_id: providerId,
			model_name: model.modelName,
			label: model.label,
			prompt_token_cost: model.promptTokenCost,
			completion_token_cost: model.completionTokenCost,
			cache_read_cost: model.cacheReadCost ?? null,
			cache_write_cost: model.cacheWriteCost ?? null,
			created_at: now,
			updated_at: now,
		})
		.execute();

	return { id, providerId, ...model };
}

export async function updateCustomModel(
	id: string,
	updates: Partial<Omit<CustomModel, "id" | "providerId">>,
): Promise<void> {
	const db = await getGlobalDb();
	const updateObj: Record<string, unknown> = { updated_at: Date.now() };

	if (updates.modelName !== undefined) updateObj.model_name = updates.modelName;
	if (updates.label !== undefined) updateObj.label = updates.label;
	if (updates.promptTokenCost !== undefined)
		updateObj.prompt_token_cost = updates.promptTokenCost;
	if (updates.completionTokenCost !== undefined)
		updateObj.completion_token_cost = updates.completionTokenCost;
	if (updates.cacheReadCost !== undefined)
		updateObj.cache_read_cost = updates.cacheReadCost ?? null;
	if (updates.cacheWriteCost !== undefined)
		updateObj.cache_write_cost = updates.cacheWriteCost ?? null;

	await db
		.updateTable("custom_models")
		.set(updateObj)
		.where("id", "=", id)
		.execute();
}

export async function deleteCustomModel(id: string): Promise<void> {
	const db = await getGlobalDb();
	await db.deleteFrom("custom_models").where("id", "=", id).execute();
}

// =============================================================================
// Custom Provider API Keys
// =============================================================================

export async function getCustomProviderApiKey(
	providerId: string,
): Promise<string | null> {
	return getSetting(apiKeySettingKey(providerId));
}

export async function setCustomProviderApiKey(
	providerId: string,
	key: string,
): Promise<void> {
	await setSetting(apiKeySettingKey(providerId), key);
}

export async function clearCustomProviderApiKey(
	providerId: string,
): Promise<void> {
	await deleteSetting(apiKeySettingKey(providerId));
}

export async function getCustomProviderKeysStatus(): Promise<
	Record<string, boolean>
> {
	const providers = await getCustomProviders();
	const entries = await Promise.all(
		providers.map(async (p) => {
			const key = await getSetting(apiKeySettingKey(p.id));
			return [p.id, key !== null && key.length > 0] as const;
		}),
	);
	return Object.fromEntries(entries);
}

// =============================================================================
// Row Mappers
// =============================================================================

function rowToProvider(row: {
	id: string;
	label: string;
	base_url: string;
	headers_json: string | null;
}): CustomProvider {
	return {
		id: row.id,
		label: row.label,
		baseUrl: row.base_url,
		headersJson: row.headers_json
			? (JSON.parse(row.headers_json) as Record<string, string>)
			: undefined,
	};
}

function rowToModel(row: {
	id: string;
	provider_id: string;
	model_name: string;
	label: string;
	prompt_token_cost: number;
	completion_token_cost: number;
	cache_read_cost: number | null;
	cache_write_cost: number | null;
}): CustomModel {
	return {
		id: row.id,
		providerId: row.provider_id,
		modelName: row.model_name,
		label: row.label,
		promptTokenCost: row.prompt_token_cost,
		completionTokenCost: row.completion_token_cost,
		cacheReadCost: row.cache_read_cost ?? undefined,
		cacheWriteCost: row.cache_write_cost ?? undefined,
	};
}
