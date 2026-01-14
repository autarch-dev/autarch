import {
	type AIProvider,
	type ApiKeysResponse,
	type ModelPreferences,
	type ModelScenario,
	ModelScenario as ModelScenarioEnum,
} from "@/shared/schemas/settings";
import { getGlobalDb } from "../db/global";

// =============================================================================
// Setting Keys
// =============================================================================

const SETTING_KEYS = {
	ONBOARDING_COMPLETE: "onboarding_complete",
	API_KEY_OPENAI: "api_key_openai",
	API_KEY_ANTHROPIC: "api_key_anthropic",
	API_KEY_GOOGLE: "api_key_google",
	API_KEY_XAI: "api_key_xai",
	MODEL_BASIC: "model_basic",
	MODEL_DISCUSSION: "model_discussion",
	MODEL_SCOPING: "model_scoping",
	MODEL_RESEARCH: "model_research",
	MODEL_PLANNING: "model_planning",
	MODEL_EXECUTION: "model_execution",
	MODEL_REVIEW: "model_review",
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

// =============================================================================
// Onboarding
// =============================================================================

export async function isOnboardingComplete(): Promise<boolean> {
	const value = await getSetting(SETTING_KEYS.ONBOARDING_COMPLETE);
	return value === "true";
}

export async function setOnboardingComplete(complete: boolean): Promise<void> {
	await setSetting(SETTING_KEYS.ONBOARDING_COMPLETE, String(complete));
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

// =============================================================================
// Model Preferences
// =============================================================================

/**
 * Get all model preferences.
 */
export async function getModelPreferences(): Promise<ModelPreferences> {
	const [basic, discussion, scoping, research, planning, execution, review] =
		await Promise.all([
			getSetting(SETTING_KEYS.MODEL_BASIC),
			getSetting(SETTING_KEYS.MODEL_DISCUSSION),
			getSetting(SETTING_KEYS.MODEL_SCOPING),
			getSetting(SETTING_KEYS.MODEL_RESEARCH),
			getSetting(SETTING_KEYS.MODEL_PLANNING),
			getSetting(SETTING_KEYS.MODEL_EXECUTION),
			getSetting(SETTING_KEYS.MODEL_REVIEW),
		]);

	return {
		basic: basic ?? undefined,
		discussion: discussion ?? undefined,
		scoping: scoping ?? undefined,
		research: research ?? undefined,
		planning: planning ?? undefined,
		execution: execution ?? undefined,
		review: review ?? undefined,
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
