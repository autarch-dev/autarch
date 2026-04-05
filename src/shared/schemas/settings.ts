import { z } from "zod";

// =============================================================================
// Enums
// =============================================================================

export const AIProvider = z.enum([
	"openai",
	"anthropic",
	"google",
	"xai",
	"bedrock",
]);
export type AIProvider = z.infer<typeof AIProvider>;

export const ModelScenario = z.enum([
	"basic",
	"discussion",
	"scoping",
	"research",
	"planning",
	"execution",
	"review",
	"roadmap_planning",
]);
export type ModelScenario = z.infer<typeof ModelScenario>;

export const IntegrationType = z.enum(["exa"]);
export type IntegrationType = z.infer<typeof IntegrationType>;

export const AgentBackend = z.enum(["api", "claude-code"]);
export type AgentBackend = z.infer<typeof AgentBackend>;

export const ClaudeCodeModel = z.enum(["opus", "sonnet", "haiku"]);
export type ClaudeCodeModel = z.infer<typeof ClaudeCodeModel>;

export const CLAUDE_CODE_MODEL_LABELS: Record<ClaudeCodeModel, string> = {
	opus: "Claude Opus",
	sonnet: "Claude Sonnet",
	haiku: "Claude Haiku",
};

export const CLAUDE_CODE_MODEL_DESCRIPTIONS: Record<ClaudeCodeModel, string> = {
	opus: "Most capable — deep reasoning, complex tasks",
	sonnet: "Balanced — fast and capable for most tasks",
	haiku: "Fastest — lightweight tasks, lowest cost",
};

/**
 * Model preferences when using the Claude Code backend.
 * Maps each agent scenario to a Claude Code model alias.
 */
export const ClaudeCodeModelPreferencesSchema = z.object({
	basic: z.string().optional(),
	discussion: z.string().optional(),
	scoping: z.string().optional(),
	research: z.string().optional(),
	planning: z.string().optional(),
	execution: z.string().optional(),
	review: z.string().optional(),
	roadmap_planning: z.string().optional(),
});
export type ClaudeCodeModelPreferences = z.infer<
	typeof ClaudeCodeModelPreferencesSchema
>;

// =============================================================================
// Onboarding
// =============================================================================

export const OnboardingStatusResponseSchema = z.object({
	isComplete: z.boolean(),
	missingApiKeys: z.boolean(),
	unconfiguredScenarios: z.array(ModelScenario),
	missingGitIdentity: z.boolean(),
});
export type OnboardingStatusResponse = z.infer<
	typeof OnboardingStatusResponseSchema
>;

// =============================================================================
// API Keys
// =============================================================================

/**
 * Response schema for GET /api/settings/api-keys
 * Returns boolean flags indicating which providers are configured (never exposes actual keys).
 * `customProviders` maps custom provider IDs to their configured status.
 */
export const ApiKeysResponseSchema = z.object({
	openai: z.boolean(),
	anthropic: z.boolean(),
	google: z.boolean(),
	xai: z.boolean(),
	bedrock: z.boolean(),
	customProviders: z.record(z.string(), z.boolean()).optional(),
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

/**
 * Request schema for DELETE /api/settings/api-keys
 */
export const DeleteApiKeyRequestSchema = z.object({
	provider: AIProvider,
});
export type DeleteApiKeyRequest = z.infer<typeof DeleteApiKeyRequestSchema>;

/** Alias for DeleteApiKeyRequestSchema - used for clearing API keys */
export const ClearApiKeyRequestSchema = DeleteApiKeyRequestSchema;
export type ClearApiKeyRequest = DeleteApiKeyRequest;

// =============================================================================
// Integrations
// =============================================================================

/**
 * Response schema for GET /api/settings/integrations
 * Returns boolean flags indicating which integrations are configured
 */
export const IntegrationsStatusResponseSchema = z.object({
	exa: z.boolean(),
});
export type IntegrationsStatusResponse = z.infer<
	typeof IntegrationsStatusResponseSchema
>;

/** Alias for IntegrationsStatusResponseSchema */
export const IntegrationsResponseSchema = IntegrationsStatusResponseSchema;
export type IntegrationsResponse = IntegrationsStatusResponse;

/**
 * Request schema for PUT /api/settings/integrations
 */
export const SetIntegrationKeyRequestSchema = z.object({
	key: z.string().min(1, "API key is required"),
});
export type SetIntegrationKeyRequest = z.infer<
	typeof SetIntegrationKeyRequestSchema
>;

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
	roadmap_planning: z.string().optional(),
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
	bedrock: "Amazon Bedrock",
};

/** Labels for model scenarios shown in settings UI */
export const MODEL_SCENARIO_LABELS: Record<ModelScenario, string> = {
	basic: "Basic Tasks",
	discussion: "Discussion Channels",
	scoping: "Scoping Agent",
	research: "Research Agent",
	planning: "Planning Agent",
	execution: "Pulsing (Execution) Agent",
	review: "Review Agent",
	roadmap_planning: "Roadmap Planning",
};

/** Descriptions for model scenarios shown in settings UI */
export const MODEL_SCENARIO_DESCRIPTIONS: Record<ModelScenario, string> = {
	basic: "Summarization and internal text generation",
	discussion: "Used for interactive discussion and brainstorming",
	scoping: "Defines project scope and requirements",
	research: "Gathers information and explores solutions",
	planning: "Creates detailed implementation plans",
	execution: "Executes tasks and writes code",
	review: "Reviews work and provides feedback",
	roadmap_planning: "AI-assisted roadmap creation and planning",
};

/** Labels for integrations shown in settings UI */
export const INTEGRATION_LABELS: Record<IntegrationType, string> = {
	exa: "Exa",
};
