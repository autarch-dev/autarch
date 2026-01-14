import { z } from "zod";

// =============================================================================
// Enums
// =============================================================================

export const AIProvider = z.enum(["openai", "anthropic", "google", "xai"]);
export type AIProvider = z.infer<typeof AIProvider>;

export const ModelScenario = z.enum([
	"basic",
	"discussion",
	"scoping",
	"research",
	"planning",
	"execution",
	"review",
]);
export type ModelScenario = z.infer<typeof ModelScenario>;

// =============================================================================
// Onboarding
// =============================================================================

export const OnboardingStatusResponseSchema = z.object({
	complete: z.boolean(),
});
export type OnboardingStatusResponse = z.infer<
	typeof OnboardingStatusResponseSchema
>;

// =============================================================================
// API Keys
// =============================================================================

/**
 * Response schema for GET /api/settings/api-keys
 * Returns boolean flags indicating which providers are configured (never exposes actual keys)
 */
export const ApiKeysResponseSchema = z.object({
	openai: z.boolean(),
	anthropic: z.boolean(),
	google: z.boolean(),
	xai: z.boolean(),
});
export type ApiKeysResponse = z.infer<typeof ApiKeysResponseSchema>;

/**
 * Request schema for PUT /api/settings/api-keys
 */
export const SetApiKeyRequestSchema = z.object({
	provider: AIProvider,
	key: z.string().min(1, "API key is required"),
});
export type SetApiKeyRequest = z.infer<typeof SetApiKeyRequestSchema>;

// =============================================================================
// Model Preferences
// =============================================================================

/**
 * Schema for model preferences - maps each scenario to its selected model string
 */
export const ModelPreferencesSchema = z.object({
	basic: z.string().optional(),
	discussion: z.string().optional(),
	scoping: z.string().optional(),
	research: z.string().optional(),
	planning: z.string().optional(),
	execution: z.string().optional(),
	review: z.string().optional(),
});
export type ModelPreferences = z.infer<typeof ModelPreferencesSchema>;

/**
 * Request schema for PUT /api/settings/models
 */
export const SetModelPreferencesRequestSchema = ModelPreferencesSchema;
export type SetModelPreferencesRequest = z.infer<
	typeof SetModelPreferencesRequestSchema
>;

// =============================================================================
// Constants
// =============================================================================

export const AI_PROVIDER_LABELS: Record<AIProvider, string> = {
	openai: "OpenAI",
	anthropic: "Anthropic",
	google: "Google (Gemini)",
	xai: "xAI (Grok)",
};

export const MODEL_SCENARIO_LABELS: Record<ModelScenario, string> = {
	basic: "Basic Tasks",
	discussion: "Discussion Channels",
	scoping: "Scoping Agent",
	research: "Research Agent",
	planning: "Planning Agent",
	execution: "Pulsing (Execution) Agent",
	review: "Review Agent",
};

export const MODEL_SCENARIO_DESCRIPTIONS: Record<ModelScenario, string> = {
	basic: "Summarization and internal text generation",
	discussion: "Used for interactive discussion and brainstorming",
	scoping: "Defines project scope and requirements",
	research: "Gathers information and explores solutions",
	planning: "Creates detailed implementation plans",
	execution: "Executes tasks and writes code",
	review: "Reviews work and provides feedback",
};
