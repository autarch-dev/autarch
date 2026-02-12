import type { z } from "zod";
import type { ModelNameSchema } from "@/shared/schemas";

type ModelName = z.infer<typeof ModelNameSchema>;

export const COST_DICTIONARY = [
	{
		modelName: "claude-opus-4-6",
		promptTokenCost: 5,
		completionTokenCost: 25,
	},
	{
		modelName: "claude-opus-4-5",
		promptTokenCost: 5,
		completionTokenCost: 25,
	},
	{
		modelName: "claude-opus-4-1",
		promptTokenCost: 15,
		completionTokenCost: 75,
	},
	{
		modelName: "claude-opus-4-0",
		promptTokenCost: 15,
		completionTokenCost: 75,
	},
	{
		modelName: "claude-sonnet-4-5",
		promptTokenCost: 3,
		completionTokenCost: 15,
	},
	{
		modelName: "claude-sonnet-4-0",
		promptTokenCost: 3,
		completionTokenCost: 15,
	},
	{
		modelName: "claude-3-7-sonnet-latest",
		promptTokenCost: 3,
		completionTokenCost: 15,
	},
	{
		modelName: "claude-3-5-haiku-latest",
		promptTokenCost: 0.8,
		completionTokenCost: 4,
	},
	{
		modelName: "claude-haiku-4-5",
		promptTokenCost: 1,
		completionTokenCost: 5,
	},
	{ modelName: "gpt-5.2", promptTokenCost: 1.75, completionTokenCost: 14.0 },
	{ modelName: "gpt-5.1", promptTokenCost: 1.25, completionTokenCost: 10.0 },
	{ modelName: "gpt-5", promptTokenCost: 1.25, completionTokenCost: 10.0 },
	{ modelName: "gpt-5-mini", promptTokenCost: 0.25, completionTokenCost: 2.0 },
	{ modelName: "gpt-5-nano", promptTokenCost: 0.05, completionTokenCost: 0.4 },

	{
		modelName: "gpt-5.2-chat-latest",
		promptTokenCost: 1.75,
		completionTokenCost: 14.0,
	},
	{
		modelName: "gpt-5.1-chat-latest",
		promptTokenCost: 1.25,
		completionTokenCost: 10.0,
	},
	{
		modelName: "gpt-5-chat-latest",
		promptTokenCost: 1.25,
		completionTokenCost: 10.0,
	},

	{
		modelName: "gpt-5.1-codex",
		promptTokenCost: 1.25,
		completionTokenCost: 10.0,
	},
	{
		modelName: "gpt-5-codex",
		promptTokenCost: 1.25,
		completionTokenCost: 10.0,
	},

	{
		modelName: "gpt-5.2-pro",
		promptTokenCost: 21.0,
		completionTokenCost: 168.0,
	},
	{ modelName: "gpt-5-pro", promptTokenCost: 15.0, completionTokenCost: 120.0 },

	{ modelName: "gpt-4.1", promptTokenCost: 2.0, completionTokenCost: 8.0 },
	{ modelName: "gpt-4.1-mini", promptTokenCost: 0.4, completionTokenCost: 1.6 },
	{ modelName: "gpt-4.1-nano", promptTokenCost: 0.1, completionTokenCost: 0.4 },

	{ modelName: "gpt-4o", promptTokenCost: 2.5, completionTokenCost: 10.0 },
	{ modelName: "gpt-4o-mini", promptTokenCost: 0.15, completionTokenCost: 0.6 },

	{
		modelName: "gpt-5.1-codex-mini",
		promptTokenCost: 0.25,
		completionTokenCost: 2.0,
	},
	{
		modelName: "gemini-3-pro-preview",
		promptTokenCost: 2.0,
		completionTokenCost: 12.0,
	},

	{
		modelName: "gemini-2.5-pro",
		promptTokenCost: 1.25,
		completionTokenCost: 10.0,
	},
	{
		modelName: "gemini-2.5-flash",
		promptTokenCost: 0.3,
		completionTokenCost: 2.5,
	},
	{
		modelName: "gemini-2.5-flash-lite",
		promptTokenCost: 0.1,
		completionTokenCost: 0.4,
	},

	{
		modelName: "gemini-2.0-flash",
		promptTokenCost: 0.1,
		completionTokenCost: 0.4,
	},
	{
		modelName: "grok-4-1-fast-reasoning",
		promptTokenCost: 0.2,
		completionTokenCost: 0.5,
	},
	{
		modelName: "grok-4-1-fast-non-reasoning",
		promptTokenCost: 0.2,
		completionTokenCost: 0.5,
	},
	{
		modelName: "grok-code-fast-1",
		promptTokenCost: 0.2,
		completionTokenCost: 1.5,
	},
	{
		modelName: "grok-4-fast-reasoning",
		promptTokenCost: 0.2,
		completionTokenCost: 0.5,
	},
	{
		modelName: "grok-4-fast-non-reasoning",
		promptTokenCost: 0.2,
		completionTokenCost: 0.5,
	},
	{ modelName: "grok-3-mini", promptTokenCost: 0.3, completionTokenCost: 0.5 },
	{ modelName: "grok-3", promptTokenCost: 3.0, completionTokenCost: 15.0 },
] as const satisfies {
	modelName: ModelName;
	promptTokenCost: number;
	completionTokenCost: number;
}[];

type MissingModels = Exclude<
	ModelName,
	(typeof COST_DICTIONARY)[number]["modelName"]
>;

// If any modelName from the schema is missing, this will error.
const _assertAllModelsCovered: MissingModels extends never ? true : never =
	true;
