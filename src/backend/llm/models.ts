/**
 * LLM Model Factory
 *
 * Creates AI SDK model instances based on user's model preferences.
 * Uses existing settings infrastructure to avoid inventing new formats.
 */

import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createXai } from "@ai-sdk/xai";
import type { LanguageModel } from "ai";
import { ALL_MODELS } from "@/features/onboarding/components/Wizard/models";
import type { AIProvider, ModelScenario } from "@/shared/schemas/settings";
import { getApiKey, getModelPreferences } from "../services/globalSettings";

// =============================================================================
// Model -> Provider Lookup
// =============================================================================

/**
 * Build model -> provider lookup from existing ALL_MODELS array.
 * This ensures we use the same model definitions as the onboarding UI.
 */
const MODEL_TO_PROVIDER = Object.fromEntries(
	ALL_MODELS.map((m) => [m.value, m.provider]),
) as Record<string, AIProvider>;

// =============================================================================
// Model Factory
// =============================================================================

/**
 * Get the AI SDK model instance for a given scenario.
 *
 * @param scenario - The agent scenario (e.g., "discussion", "scoping")
 * @returns AI SDK LanguageModelV1 instance
 * @throws Error if no model is configured, model is unknown, or no API key
 */
export async function getModelForScenario(
	scenario: ModelScenario,
): Promise<LanguageModel> {
	// Get user's model preference for this scenario
	const prefs = await getModelPreferences();

	// Preflight uses execution's model (no separate preference)
	const effectiveScenario = scenario === "preflight" ? "execution" : scenario;
	const modelName = prefs[effectiveScenario];

	if (!modelName) {
		throw new Error(
			`No model configured for scenario "${effectiveScenario}". Please complete onboarding or set model preferences.`,
		);
	}

	// Look up the provider for this model
	const provider = MODEL_TO_PROVIDER[modelName];
	if (!provider) {
		throw new Error(
			`Unknown model "${modelName}". It may have been removed from the available models list.`,
		);
	}

	// Get the API key for this provider
	const apiKey = await getApiKey(provider);
	if (!apiKey) {
		throw new Error(
			`No API key configured for ${provider}. Please add your API key in settings.`,
		);
	}

	// Create and return the appropriate AI SDK model
	return createModel(provider, modelName, apiKey);
}

/**
 * Create an AI SDK model instance for a specific provider.
 */
function createModel(
	provider: AIProvider,
	modelName: string,
	apiKey: string,
): LanguageModel {
	switch (provider) {
		case "anthropic": {
			const anthropic = createAnthropic({ apiKey });
			return anthropic(modelName);
		}
		case "openai": {
			const openai = createOpenAI({ apiKey });
			return openai(modelName);
		}
		case "google": {
			const google = createGoogleGenerativeAI({ apiKey });
			return google(modelName);
		}
		case "xai": {
			const xai = createXai({ apiKey });
			return xai(modelName);
		}
		default: {
			// Type-safe exhaustive check
			const _exhaustive: never = provider;
			throw new Error(`Unsupported provider: ${_exhaustive}`);
		}
	}
}

/**
 * Check if a model name is valid (exists in ALL_MODELS).
 */
export function isValidModel(modelName: string): boolean {
	return modelName in MODEL_TO_PROVIDER;
}

/**
 * Get the provider for a model name.
 */
export function getProviderForModel(modelName: string): AIProvider | undefined {
	return MODEL_TO_PROVIDER[modelName];
}
