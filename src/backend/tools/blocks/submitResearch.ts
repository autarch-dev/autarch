/**
 * submit_research - Submit completed research findings for user approval
 */

import { z } from "zod";
import type { ToolDefinition, ToolResult } from "../types";

// =============================================================================
// Schema
// =============================================================================

const keyFileSchema = z.object({
	path: z.string(),
	purpose: z.string(),
	lineRanges: z.string().optional(),
});

const patternSchema = z.object({
	category: z.string(),
	description: z.string(),
	example: z.string(),
	locations: z.array(z.string()),
});

const dependencySchema = z.object({
	name: z.string(),
	purpose: z.string(),
	usageExample: z.string(),
});

const integrationPointSchema = z.object({
	location: z.string(),
	description: z.string(),
	existingCode: z.string(),
});

const challengeSchema = z.object({
	issue: z.string(),
	mitigation: z.string(),
});

export const submitResearchInputSchema = z.object({
	summary: z
		.string()
		.describe("Concise, factual overview of how the relevant system works"),
	keyFiles: z
		.array(keyFileSchema)
		.describe("Important files discovered during research"),
	patterns: z
		.array(patternSchema)
		.optional()
		.describe("Observed patterns used consistently across the codebase"),
	dependencies: z
		.array(dependencySchema)
		.optional()
		.describe("External libraries or modules relevant to the work"),
	integrationPoints: z
		.array(integrationPointSchema)
		.optional()
		.describe("Locations where new behavior should attach"),
	challenges: z
		.array(challengeSchema)
		.optional()
		.describe("Technical or architectural risks"),
	recommendations: z
		.array(z.string())
		.describe("Clear, directive guidance for implementation"),
});

export type SubmitResearchInput = z.infer<typeof submitResearchInputSchema>;

export interface SubmitResearchOutput {
	success: boolean;
	research_card_id: string;
}

// =============================================================================
// Tool Definition
// =============================================================================

export const submitResearchTool: ToolDefinition<
	SubmitResearchInput,
	SubmitResearchOutput
> = {
	name: "submit_research",
	description: `Submit completed research findings for user approval.
Use when sufficient understanding has been built to guide implementation.`,
	inputSchema: submitResearchInputSchema,
	execute: async (
		_input,
		_context,
	): Promise<ToolResult<SubmitResearchOutput>> => {
		return {
			success: false,
			error: "submit_research not implemented",
		};
	},
};
