/**
 * submit_research - Submit completed research findings for user approval
 *
 * Persists the research card to the database and triggers the approval workflow.
 * The workflow will await user approval before transitioning to the planning phase.
 */

import { z } from "zod";
import { getWorkflowOrchestrator } from "@/backend/agents/runner";
import { getProjectDb } from "@/backend/db/project";
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
	message: string;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Generate a unique research card ID
 */
function generateResearchCardId(): string {
	return `research_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
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
Use when sufficient understanding has been built to guide implementation.
After submitting, the workflow will await user approval before transitioning to planning.`,
	inputSchema: submitResearchInputSchema,
	execute: async (
		input,
		context,
	): Promise<ToolResult<SubmitResearchOutput>> => {
		// Workflow ID is required for storing research cards
		if (!context.workflowId) {
			return {
				success: false,
				error:
					"No workflow context - submit_research can only be used in workflow sessions",
			};
		}

		// Get database connection
		const db = await getProjectDb(context.projectRoot);

		const now = Date.now();
		const researchCardId = generateResearchCardId();

		try {
			// Insert the research card into the database
			await db
				.insertInto("research_cards")
				.values({
					id: researchCardId,
					workflow_id: context.workflowId,
					summary: input.summary,
					key_files_json: JSON.stringify(input.keyFiles),
					patterns_json: input.patterns ? JSON.stringify(input.patterns) : null,
					dependencies_json: input.dependencies
						? JSON.stringify(input.dependencies)
						: null,
					integration_points_json: input.integrationPoints
						? JSON.stringify(input.integrationPoints)
						: null,
					challenges_json: input.challenges
						? JSON.stringify(input.challenges)
						: null,
					recommendations_json: JSON.stringify(input.recommendations),
					created_at: now,
				})
				.execute();

			// Notify the workflow orchestrator about the tool result
			// This will set the workflow to awaiting_approval state and broadcast the event
			const orchestrator = getWorkflowOrchestrator();
			await orchestrator.handleToolResult(
				context.workflowId,
				"submit_research",
				researchCardId,
			);

			return {
				success: true,
				data: {
					success: true,
					research_card_id: researchCardId,
					message:
						"Research findings submitted successfully. Awaiting user approval before proceeding to planning phase.",
				},
			};
		} catch (err) {
			return {
				success: false,
				error: `Failed to submit research card: ${err instanceof Error ? err.message : "unknown error"}`,
			};
		}
	},
};
