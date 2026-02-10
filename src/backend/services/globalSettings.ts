import { SCENARIOS } from "@/shared/schemas/models";
import {
	type AIProvider,
	type ApiKeysResponse,
	type ModelPreferences,
	type ModelScenario,
	ModelScenario as ModelScenarioEnum,
	type OnboardingStatusResponse,
} from "@/shared/schemas/settings";
import { getGlobalDb } from "../db/global";
import {
	getGitAuthorEmail,
	getGitAuthorName,
} from "../services/projectSettings";

// =============================================================================
// Setting Keys
// =============================================================================

const SETTING_KEYS = {
	API_KEY_OPENAI: "api_key_openai",
	API_KEY_ANTHROPIC: "api_key_anthropic",
	API_KEY_GOOGLE: "api_key_google",
	API_KEY_XAI: "api_key_xai",
	API_KEY_EXA: "api_key_exa",
	MODEL_BASIC: "model_basic",
	MODEL_DISCUSSION: "model_discussion",
	MODEL_SCOPING: "model_scoping",
	MODEL_RESEARCH: "model_research",
	MODEL_PLANNING: "model_planning",
	MODEL_EXECUTION: "model_execution",
	MODEL_REVIEW: "model_review",
	MODEL_ROADMAP_PLANNING: "model_roadmap_planning",
} as const;

const PROVIDER_TO_KEY = {
	openai: SETTING_KEYS.API_KEY_OPENAI,
	anthropic: SETTING_KEYS.API_KEY_ANTHROPIC,
	google: SETTING_KEYS.API_KEY_GOOGLE,
	xai: SETTING_KEYS.API_KEY_XAI,
} as const satisfies Record<
	AIProvider,
	(typeof SETTING_KEYS)[keyof typeof SETTING_KEYS]
>;

const SCENARIO_TO_KEY = {
	basic: SETTING_KEYS.MODEL_BASIC,
	discussion: SETTING_KEYS.MODEL_DISCUSSION,
	scoping: SETTING_KEYS.MODEL_SCOPING,
	research: SETTING_KEYS.MODEL_RESEARCH,
	planning: SETTING_KEYS.MODEL_PLANNING,
	execution: SETTING_KEYS.MODEL_EXECUTION,
	review: SETTING_KEYS.MODEL_REVIEW,
	roadmap_planning: SETTING_KEYS.MODEL_ROADMAP_PLANNING,
} as const satisfies Record<
	ModelScenario,
	(typeof SETTING_KEYS)[keyof typeof SETTING_KEYS]
>;

// =============================================================================
// Low-Level Helpers
// =============================================================================

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

async function deleteSetting(key: string): Promise<void> {
	const db = await getGlobalDb();
	await db.deleteFrom("settings").where("key", "=", key).execute();
}

// =============================================================================
// API Keys
// =============================================================================

/**
 * Get a map of which providers have API keys configured.
 * Never returns the actual keys for security.
 */
export async function getApiKeysStatus(): Promise<ApiKeysResponse> {
	const [openai, anthropic, google, xai] = await Promise.all([
		getSetting(SETTING_KEYS.API_KEY_OPENAI),
		getSetting(SETTING_KEYS.API_KEY_ANTHROPIC),
		getSetting(SETTING_KEYS.API_KEY_GOOGLE),
		getSetting(SETTING_KEYS.API_KEY_XAI),
	]);

	return {
		openai: openai !== null && openai.length > 0,
		anthropic: anthropic !== null && anthropic.length > 0,
		google: google !== null && google.length > 0,
		xai: xai !== null && xai.length > 0,
	};
}

/**
 * Set an API key for a specific provider.
 */
export async function setApiKey(
	provider: AIProvider,
	key: string,
): Promise<void> {
	const settingKey = PROVIDER_TO_KEY[provider];
	await setSetting(settingKey, key);
}

/**
 * Get the raw API key for a provider (for internal use only).
 */
export async function getApiKey(provider: AIProvider): Promise<string | null> {
	const settingKey = PROVIDER_TO_KEY[provider];
	return getSetting(settingKey);
}

/**
 * Clear (delete) an API key for a specific provider.
 */
export async function clearApiKey(provider: AIProvider): Promise<void> {
	const settingKey = PROVIDER_TO_KEY[provider];
	await deleteSetting(settingKey);
}

// =============================================================================
// Exa API Key (Integrations)
// =============================================================================

/**
 * Get the Exa API key (for internal use only).
 */
export async function getExaApiKey(): Promise<string | null> {
	return getSetting(SETTING_KEYS.API_KEY_EXA);
}

/**
 * Set the Exa API key.
 */
export async function setExaApiKey(key: string): Promise<void> {
	await setSetting(SETTING_KEYS.API_KEY_EXA, key);
}

/**
 * Check if Exa API key is configured.
 */
export async function isExaKeyConfigured(): Promise<boolean> {
	const key = await getExaApiKey();
	return key !== null && key.length > 0;
}

/**
 * Clear (delete) the Exa API key.
 */
export async function clearExaApiKey(): Promise<void> {
	await deleteSetting(SETTING_KEYS.API_KEY_EXA);
}

// =============================================================================
// Model Preferences
// =============================================================================

/**
 * Get all model preferences.
 */
export async function getModelPreferences(): Promise<ModelPreferences> {
	const [
		basic,
		discussion,
		scoping,
		research,
		planning,
		execution,
		review,
		roadmap_planning,
	] = await Promise.all([
		getSetting(SETTING_KEYS.MODEL_BASIC),
		getSetting(SETTING_KEYS.MODEL_DISCUSSION),
		getSetting(SETTING_KEYS.MODEL_SCOPING),
		getSetting(SETTING_KEYS.MODEL_RESEARCH),
		getSetting(SETTING_KEYS.MODEL_PLANNING),
		getSetting(SETTING_KEYS.MODEL_EXECUTION),
		getSetting(SETTING_KEYS.MODEL_REVIEW),
		getSetting(SETTING_KEYS.MODEL_ROADMAP_PLANNING),
	]);

	return {
		basic: basic ?? undefined,
		discussion: discussion ?? undefined,
		scoping: scoping ?? undefined,
		research: research ?? undefined,
		planning: planning ?? undefined,
		execution: execution ?? undefined,
		review: review ?? undefined,
		roadmap_planning: roadmap_planning ?? undefined,
	};
}

/**
 * Set a model preference for a specific scenario.
 */
export async function setModelPreference(
	scenario: ModelScenario,
	model: string,
): Promise<void> {
	const settingKey = SCENARIO_TO_KEY[scenario];
	await setSetting(settingKey, model);
}

/**
 * Set multiple model preferences at once.
 */
export async function setModelPreferences(
	preferences: ModelPreferences,
): Promise<void> {
	// Use Zod enum's .options for type-safe keys, flatMap to filter in one pass
	const updates = ModelScenarioEnum.options.flatMap((scenario) => {
		const model = preferences[scenario];
		return model !== undefined ? [setModelPreference(scenario, model)] : [];
	});

	await Promise.all(updates);
}

// =============================================================================
// Onboarding Status (Derived)
// =============================================================================

/**
 * Derive onboarding completeness from actual settings state.
 * Checks API keys, model preferences for every scenario, and git identity.
 */
export async function getOnboardingStatus(
	projectRoot: string,
): Promise<OnboardingStatusResponse> {
	const [apiKeys, modelPrefs, gitName, gitEmail] = await Promise.all([
		getApiKeysStatus(),
		getModelPreferences(),
		getGitAuthorName(projectRoot),
		getGitAuthorEmail(projectRoot),
	]);

	// At least one provider must have an API key configured
	const missingApiKeys = !Object.values(apiKeys).some(Boolean);

	// Every scenario must have a non-empty model selected
	const unconfiguredScenarios = SCENARIOS.filter((scenario) => {
		const pref = modelPrefs[scenario];
		return pref === undefined || pref === "";
	});

	// Both git author name and email must be non-null and non-empty
	const missingGitIdentity =
		!gitName || gitName.length === 0 || !gitEmail || gitEmail.length === 0;

	const isComplete =
		!missingApiKeys &&
		unconfiguredScenarios.length === 0 &&
		!missingGitIdentity;

	return {
		isComplete,
		missingApiKeys,
		unconfiguredScenarios,
		missingGitIdentity,
	};
}
