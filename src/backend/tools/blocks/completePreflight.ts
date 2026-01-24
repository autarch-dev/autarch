/**
 * complete_preflight - Signal preflight environment setup is complete
 */

import { z } from "zod";
import { log } from "@/backend/logger";
import { getRepositories } from "@/backend/repositories";
import type { ToolDefinition, ToolResult } from "../types";

// =============================================================================
// Schema
// =============================================================================

export const completePreflightInputSchema = z.object({
	summary: z.string().describe("Brief description of setup completed"),
	setupCommands: z
		.array(z.string())
		.describe("List of commands that were executed"),
	buildSuccess: z.boolean().describe("Whether the project builds successfully"),
	baselinesRecorded: z.number().describe("Count of baseline issues recorded"),
	verificationCommands: z
		.array(z.string())
		.optional()
		.describe(
			"Array of shell commands for verification (build, typecheck, lint, test)",
		),
});

export type CompletePreflightInput = z.infer<
	typeof completePreflightInputSchema
>;

// =============================================================================
// Tool Definition
// =============================================================================

export const completePreflightTool: ToolDefinition<CompletePreflightInput> = {
	name: "complete_preflight",
	description: `Signal preflight environment setup is complete.
Use after initializing dependencies and recording baselines.

Provide:
- summary: Brief description of what was set up
- setupCommands: List of commands that were run
- buildSuccess: Whether the project builds successfully
- baselinesRecorded: Count of baseline issues recorded`,
	inputSchema: completePreflightInputSchema,
	execute: async (input, context): Promise<ToolResult> => {
		// Validate we have a workflow context
		if (!context.workflowId) {
			return {
				success: false,
				output: "Error: complete_preflight requires a workflow context",
			};
		}

		// If build failed, we cannot proceed
		if (!input.buildSuccess) {
			return {
				success: false,
				output:
					"Error: Cannot complete preflight: build did not succeed. Fix build issues or record them as baselines if they are pre-existing.",
			};
		}

		try {
			const { pulses } = getRepositories();

			// Mark preflight as complete in the database
			// Note: Session transition to first pulse is handled by AgentRunner
			// after this turn completes (via handleTurnCompletion)
			await pulses.completePreflightSetup(
				context.workflowId,
				input.verificationCommands,
			);

			log.workflow.info(
				`Preflight complete for workflow ${context.workflowId}: ${input.summary}`,
			);

			return {
				success: true,
				output: `Preflight complete. Setup: ${input.setupCommands.length} commands run, ${input.baselinesRecorded} baselines recorded. Wait for the user to respond.`,
			};
		} catch (error) {
			return {
				success: false,
				output: `Error: ${error instanceof Error ? error.message : "Failed to complete preflight"}`,
			};
		}
	},
};
