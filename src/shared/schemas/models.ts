import { z } from "zod";
import { type AIProvider, ModelScenario } from "./settings";

export const SCENARIOS = ModelScenario.options;

// Recommended default model per agent, per provider (fill in preferred defaults)
export const RECOMMENDED_MODELS = {
	basic: {
		anthropic: "claude-haiku-4-5",
		openai: "gpt-5-nano",
		google: "gemini-2.5-flash-lite",
		xai: "grok-3-mini-fast",
	},
	discussion: {
		anthropic: "claude-opus-4-5",
		openai: "gpt-5",
		google: "gemini-3-pro-preview",
		xai: "grok-4-fast-reasoning",
	},
	scoping: {
		anthropic: "claude-opus-4-5",
		openai: "gpt-5.2",
		google: "gemini-3-pro-preview",
		xai: "grok-4-fast-reasoning",
	},
	research: {
		anthropic: "claude-opus-4-5",
		openai: "gpt-5.2",
		google: "gemini-3-pro-preview",
		xai: "grok-4-fast-reasoning",
	},
	planning: {
		anthropic: "claude-sonnet-4-5",
		openai: "gpt-5.1-codex",
		google: "gemini-3-pro-preview",
		xai: "grok-4-fast-reasoning",
	},
	execution: {
		anthropic: "claude-opus-4-5",
		openai: "gpt-5.1-codex",
		google: "gemini-3-pro-preview",
		xai: "grok-code-fast-1",
	},
	review: {
		anthropic: "claude-opus-4-5",
		openai: "gpt-5.2",
		google: "gemini-3-pro-preview",
		xai: "grok-4-fast-reasoning",
	},
	roadmap_planning: {
		anthropic: "claude-opus-4-5",
		openai: "gpt-5.2",
		google: "gemini-3-pro-preview",
		xai: "grok-4-fast-reasoning",
	},
} as const satisfies Record<ModelScenario, Record<AIProvider, string>>;

// Models mapped to their provider
export const ALL_MODELS = [
	// Anthropic
	{ value: "claude-opus-4-6", label: "Claude Opus 4.6", provider: "anthropic" },
	{ value: "claude-opus-4-5", label: "Claude Opus 4.5", provider: "anthropic" },
	{
		value: "claude-haiku-4-5",
		label: "Claude Haiku 4.5",
		provider: "anthropic",
	},
	{
		value: "claude-sonnet-4-5",
		label: "Claude Sonnet 4.5",
		provider: "anthropic",
	},
	{ value: "claude-opus-4-1", label: "Claude Opus 4.1", provider: "anthropic" },
	{ value: "claude-opus-4-0", label: "Claude Opus 4.0", provider: "anthropic" },
	{
		value: "claude-sonnet-4-0",
		label: "Claude Sonnet 4.0",
		provider: "anthropic",
	},
	{
		value: "claude-3-7-sonnet-latest",
		label: "Claude 3.7 Sonnet",
		provider: "anthropic",
	},
	{
		value: "claude-3-5-haiku-latest",
		label: "Claude 3.5 Haiku",
		provider: "anthropic",
	},

	// OpenAI
	{ value: "gpt-5.2-pro", label: "GPT-5.2 Pro", provider: "openai" },
	{ value: "gpt-5.2-chat-latest", label: "GPT-5.2 Chat", provider: "openai" },
	{ value: "gpt-5.2", label: "GPT-5.2", provider: "openai" },
	{
		value: "gpt-5.1-codex-mini",
		label: "GPT-5.1 Codex Mini",
		provider: "openai",
	},
	{ value: "gpt-5.1-codex", label: "GPT-5.1 Codex", provider: "openai" },
	{ value: "gpt-5.1-chat-latest", label: "GPT-5.1 Chat", provider: "openai" },
	{ value: "gpt-5.1", label: "GPT-5.1", provider: "openai" },
	{ value: "gpt-5-pro", label: "GPT-5 Pro", provider: "openai" },
	{ value: "gpt-5", label: "GPT-5", provider: "openai" },
	{ value: "gpt-5-mini", label: "GPT-5 Mini", provider: "openai" },
	{ value: "gpt-5-nano", label: "GPT-5 Nano", provider: "openai" },
	{ value: "gpt-5-codex", label: "GPT-5 Codex", provider: "openai" },
	{ value: "gpt-5-chat-latest", label: "GPT-5 Chat", provider: "openai" },
	{ value: "gpt-4.1", label: "GPT-4.1", provider: "openai" },
	{ value: "gpt-4.1-mini", label: "GPT-4.1 Mini", provider: "openai" },
	{ value: "gpt-4.1-nano", label: "GPT-4.1 Nano", provider: "openai" },
	{ value: "gpt-4o", label: "GPT-4o", provider: "openai" },
	{ value: "gpt-4o-mini", label: "GPT-4o Mini", provider: "openai" },

	// Google
	{
		value: "gemini-3-pro-preview",
		label: "Gemini 3 Pro Preview",
		provider: "google",
	},
	{ value: "gemini-2.5-pro", label: "Gemini 2.5 Pro", provider: "google" },
	{ value: "gemini-2.5-flash", label: "Gemini 2.5 Flash", provider: "google" },
	{
		value: "gemini-2.5-flash-lite",
		label: "Gemini 2.5 Flash Lite",
		provider: "google",
	},
	{ value: "gemini-2.0-flash", label: "Gemini 2.0 Flash", provider: "google" },

	// xAI (Grok)
	{
		value: "grok-4-1-fast-non-reasoning",
		label: "Grok 4.1 Fast (Non-Reasoning)",
		provider: "xai",
	},
	{
		value: "grok-4-1-fast-reasoning",
		label: "Grok 4.1 Fast (Reasoning)",
		provider: "xai",
	},
	{
		value: "grok-4-fast-non-reasoning",
		label: "Grok 4 Fast (Non-Reasoning)",
		provider: "xai",
	},
	{
		value: "grok-4-fast-reasoning",
		label: "Grok 4 Fast (Reasoning)",
		provider: "xai",
	},
	{ value: "grok-code-fast-1", label: "Grok Code Fast 1", provider: "xai" },
	{ value: "grok-3", label: "Grok 3", provider: "xai" },
	{ value: "grok-3-mini", label: "Grok 3 Mini", provider: "xai" },
] as const satisfies { value: string; label: string; provider: AIProvider }[];

export const ModelNameSchema = z.union(
	ALL_MODELS.map((m) => z.literal(m.value)),
);
export type ModelName = z.infer<typeof ModelNameSchema>;
