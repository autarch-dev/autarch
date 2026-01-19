/**
 * complete_review - Complete the review with a recommendation and summary
 *
 * Finalizes the review card with the agent's recommendation and summary.
 * Triggers the approval workflow for user review before workflow completion.
 */

import { z } from "zod";
import { getWorkflowOrchestrator } from "@/backend/agents/runner";
import { getRepositories } from "@/backend/repositories";
import {
	REASON_DESCRIPTION,
	type ToolDefinition,
	type ToolResult,
} from "../types";

// =============================================================================
// Schema
// =============================================================================

// Base fields shared by all recommendation types
const baseReviewFields = {
	reason: z.string().describe(REASON_DESCRIPTION),
	summary: z
		.string()
		.min(1)
		.describe("A summary explanation for the recommendation"),
};

// Discriminated union: suggestedCommitMessage is only required for "approve"
export const completeReviewInputSchema = z.discriminatedUnion(
	"recommendation",
	[
		z.object({
			...baseReviewFields,
			recommendation: z
				.literal("approve")
				.describe("Approve the changes for merge"),
			suggestedCommitMessage: z
				.string()
				.min(1)
				.describe(
					"Suggested commit message in Conventional Commit format (required for approve)",
				),
		}),
		z.object({
			...baseReviewFields,
			recommendation: z.literal("deny").describe("Deny the changes"),
			suggestedCommitMessage: z
				.string()
				.optional()
				.describe("Optional commit message suggestion"),
		}),
		z.object({
			...baseReviewFields,
			recommendation: z
				.literal("manual_review")
				.describe("Request manual human review"),
			suggestedCommitMessage: z
				.string()
				.optional()
				.describe("Optional commit message suggestion"),
		}),
	],
);

export type CompleteReviewInput = z.infer<typeof completeReviewInputSchema>;

// =============================================================================
// Tool Definition
// =============================================================================

export const completeReviewTool: ToolDefinition<CompleteReviewInput> = {
	name: "complete_review",
	description: `Complete the review with a recommendation and summary.
Call this tool once after adding all comments to finalize the review.
The recommendation must be one of: approve, deny, or manual_review.`,
	inputSchema: completeReviewInputSchema,
	execute: async (input, context): Promise<ToolResult> => {
		// Workflow ID is required for review operations
		if (!context.workflowId) {
			return {
				success: false,
				output:
					"Error: No workflow context - complete_review can only be used in workflow sessions",
			};
		}

		try {
			const { artifacts } = getRepositories();

			// Get the current review card for this workflow
			const reviewCard = await artifacts.getLatestReviewCard(
				context.workflowId,
			);
			if (!reviewCard) {
				return {
					success: false,
					output: "Error: No review card found for this workflow",
				};
			}

			// Update the review card with recommendation, summary, and suggested commit message
			await artifacts.updateReviewCardCompletion(
				reviewCard.id,
				input.recommendation,
				input.summary,
				input.suggestedCommitMessage,
			);

			if (context.turnId) {
				await artifacts.updateLatestReviewCardTurnId(
					context.workflowId,
					context.turnId,
				);
			}

			// Notify the workflow orchestrator about the tool result
			// This will set the workflow to awaiting_approval state and broadcast the event
			const orchestrator = getWorkflowOrchestrator();
			await orchestrator.handleToolResult(
				context.workflowId,
				"complete_review",
				reviewCard.id,
			);

			return {
				success: true,
				output: `Review completed successfully.\nRecommendation: ${input.recommendation}\nSummary: ${input.summary}\n\nWait for the user to approve the review.`,
			};
		} catch (error) {
			return {
				success: false,
				output: `Error: Failed to complete review: ${error instanceof Error ? error.message : "unknown error"}`,
			};
		}
	},
};
