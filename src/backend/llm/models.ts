/**
 * LLM Model Factory
 *
 * Creates AI SDK model instances based on user's model preferences.
 * Supports both built-in providers (OpenAI, Anthropic, Google, xAI) and
 * user-defined custom providers via the OpenAI-compatible protocol.
 */

import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createXai } from "@ai-sdk/xai";
import type { LanguageModel } from "ai";
import { type AIProvider, ALL_MODELS } from "@/shared/schemas";
import type { AgentRole } from "../agents/types";
import {
	getCustomModel,
	getCustomProvider,
	getCustomProviderApiKey,
} from "../services/customProviders";
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

export interface ModelWithId {
	model: LanguageModel;
	modelId: string;
}

/**
 * Get the AI SDK model instance for a given agent role.
 *
 * @param role - The agent role (e.g., "discussion", "scoping", "preflight")
 * @returns AI SDK LanguageModelV1 instance and its model ID
 * @throws Error if no model is configured, model is unknown, or no API key
 */
export async function getModelForScenario(
	role: AgentRole,
): Promise<ModelWithId> {
	// Get user's model preference for this scenario
	const prefs = await getModelPreferences();

	// Preflight uses execution's model, review_sub uses review's model,
	// persona/synthesis roles use roadmap_planning's model (no separate preference)
	const effectiveScenario =
		role === "preflight"
			? "execution"
			: role === "review_sub"
				? "review"
				: role === "visionary" ||
						role === "iterative" ||
						role === "tech_lead" ||
						role === "pathfinder" ||
						role === "synthesis"
					? "roadmap_planning"
					: role;
	const modelId = prefs[effectiveScenario];

	if (!modelId) {
		throw new Error(
			`No model configured for scenario "${effectiveScenario}". Please complete onboarding or set model preferences.`,
		);
	}

	// Try built-in provider first
	const builtInProvider = MODEL_TO_PROVIDER[modelId];
	if (builtInProvider) {
		const apiKey = await getApiKey(builtInProvider);
		if (!apiKey) {
			throw new Error(
				`No API key configured for ${builtInProvider}. Please add your API key in settings.`,
			);
		}
		return {
			model: createBuiltInModel(builtInProvider, modelId, apiKey),
			modelId,
		};
	}

	// Fall back to custom provider lookup
	return resolveCustomModel(modelId);
}

/**
 * Resolve a model ID against user-defined custom providers.
 * Custom model IDs have the format "{providerId}/{modelName}".
 */
async function resolveCustomModel(modelId: string): Promise<ModelWithId> {
	const customModel = await getCustomModel(modelId);
	if (!customModel) {
		throw new Error(
			`Unknown model "${modelId}". It may have been removed from the available models list.`,
		);
	}

	const provider = await getCustomProvider(customModel.providerId);
	if (!provider) {
		throw new Error(
			`Custom provider "${customModel.providerId}" not found for model "${modelId}".`,
		);
	}

	const apiKey = await getCustomProviderApiKey(provider.id);
	if (!apiKey) {
		throw new Error(
			`No API key configured for custom provider "${provider.label}". Please add your API key in settings.`,
		);
	}

	const compat = createOpenAICompatible({
		name: provider.id,
		baseURL: provider.baseUrl,
		apiKey,
		headers: provider.headersJson ?? undefined,
	});

	return {
		model: compat(customModel.modelName),
		modelId,
	};
}

/**
 * Create an AI SDK model instance for a built-in provider.
 */
function createBuiltInModel(
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
			const _exhaustive: never = provider;
			throw new Error(`Unsupported provider: ${_exhaustive}`);
		}
	}
}

/**
 * Check if a model name is valid (exists in ALL_MODELS or custom models).
 * For synchronous checks, only validates built-in models.
 */
export function isValidModel(modelName: string): boolean {
	return modelName in MODEL_TO_PROVIDER;
}

/**
 * Get the built-in provider for a model name.
 * Returns undefined for custom models (use getCustomModel instead).
 */
export function getProviderForModel(modelName: string): AIProvider | undefined {
	return MODEL_TO_PROVIDER[modelName];
}
