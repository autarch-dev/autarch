/**
 * complete_pulse - Signal pulse completion with a summary
 */

import { z } from "zod";
import { getWorkflowOrchestrator } from "@/backend/agents/runner";
import { log } from "@/backend/logger";
import { getRepositories } from "@/backend/repositories";
import { CompletionValidator } from "@/backend/services/pulsing/CompletionValidator";
import type { ToolDefinition, ToolResult } from "../types";

// =============================================================================
// Schema
// =============================================================================

const unresolvedIssueSchema = z.object({
	issue: z.string().describe("Description of the issue"),
	reason: z.string().describe("Why this issue cannot be fixed"),
});

export const completePulseInputSchema = z.object({
	summary: z
		.string()
		.describe(
			'Conventional commit message (e.g., "feat(auth): implement login flow")',
		),
	unresolvedIssues: z
		.array(unresolvedIssueSchema)
		.optional()
		.describe(
			"Acknowledged issues that couldn't be fixed (escape hatch). Only use after attempts to fix have failed.",
		),
});

export type CompletePulseInput = z.infer<typeof completePulseInputSchema>;

// =============================================================================
// Tool Definition
// =============================================================================

export const completePulseTool: ToolDefinition<CompletePulseInput> = {
	name: "complete_pulse",
	description: `Signal pulse completion with a summary suitable for commit message.
Only use when ALL pulse requirements are satisfied — code complete and clean.
The summary field becomes the commit message. Format it as a Conventional Commit.

If you encounter issues you genuinely cannot fix (e.g., pre-existing flaky tests),
you may use unresolvedIssues after multiple attempts. This will halt automatic
orchestration for human review.`,
	inputSchema: completePulseInputSchema,
	execute: async (input, context): Promise<ToolResult> => {
		// Validate we have required context
		if (!context.workflowId) {
			return {
				success: false,
				output: "Error: complete_pulse requires a workflow context",
			};
		}

		if (!context.sessionId) {
			return {
				success: false,
				output: "Error: complete_pulse requires a session context",
			};
		}

		try {
			const { pulses, conversations } = getRepositories();

			// Get the running pulse for this workflow
			const pulse = await pulses.getRunningPulse(context.workflowId);
			if (!pulse) {
				return {
					success: false,
					output: "Error: No running pulse found for this workflow",
				};
			}

			// Create validator and validate completion
			const validator = new CompletionValidator(conversations, pulses);
			const hasUnresolvedIssues =
				input.unresolvedIssues && input.unresolvedIssues.length > 0;

			const validation = await validator.validateCompletion(
				pulse.id,
				context.sessionId,
				hasUnresolvedIssues ?? false,
			);

			if (!validation.valid) {
				// Increment rejection count
				await validator.rejectCompletion(pulse.id);

				log.workflow.info(
					`Pulse completion rejected for ${pulse.id}: ${validation.rejectionReason}`,
				);

				return {
					success: false,
					output: `Error: ${validation.rejectionReason}`,
				};
			}

			// Validation passed - trigger the orchestrator to commit and handle next steps
			log.workflow.info(
				`Pulse completion validated for ${pulse.id}: ${input.summary}`,
			);

			// Let orchestrator handle the commit, merge, and next pulse/review transition
			const orchestrator = getWorkflowOrchestrator();
			await orchestrator.handlePulseCompletion(
				context.workflowId,
				input.summary,
				hasUnresolvedIssues ?? false,
			);

			const lines = [
				"Pulse completed. Changes committed and merged.",
				`Commit message: ${input.summary}`,
				"Wait for the user to respond.",
			];
			if (hasUnresolvedIssues) {
				lines.push(
					`Warning: ${input.unresolvedIssues?.length} unresolved issue(s) acknowledged. Orchestration halted for review.`,
				);
			}

			return {
				success: true,
				output: lines.join("\n"),
			};
		} catch (error) {
			return {
				success: false,
				output: `Error: ${error instanceof Error ? error.message : "Failed to complete pulse"}`,
			};
		}
	},
};
