/**
 * submit_plan - Submit an execution plan for user approval
 *
 * Persists the plan to the database and triggers the approval workflow.
 * The workflow will await user approval before transitioning to the execution phase.
 */

import { z } from "zod";
import { getWorkflowOrchestrator } from "@/backend/agents/runner";
import { getProjectDb } from "@/backend/db/project";
import type { ToolDefinition, ToolResult } from "../types";

// =============================================================================
// Schema
// =============================================================================

const pulseSchema = z.object({
	id: z.string(),
	title: z.string(),
	description: z.string(),
	expectedChanges: z.array(z.string()),
	estimatedSize: z.enum(["small", "medium", "large"]),
	dependsOn: z.array(z.string()).optional(),
});

export const submitPlanInputSchema = z.object({
	approachSummary: z
		.string()
		.describe("High-level description of how the solution will be implemented"),
	pulses: z.array(pulseSchema).describe("Ordered list of execution units"),
});

export type SubmitPlanInput = z.infer<typeof submitPlanInputSchema>;

export interface SubmitPlanOutput {
	success: boolean;
	plan_id: string;
	message: string;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Generate a unique plan ID
 */
function generatePlanId(): string {
	return `plan_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// =============================================================================
// Tool Definition
// =============================================================================

export const submitPlanTool: ToolDefinition<SubmitPlanInput, SubmitPlanOutput> =
	{
		name: "submit_plan",
		description: `Submit an execution plan for user approval.
Use after verifying research findings against the codebase.
After submitting, the workflow will await user approval before transitioning to execution.`,
		inputSchema: submitPlanInputSchema,
		execute: async (input, context): Promise<ToolResult<SubmitPlanOutput>> => {
			// Workflow ID is required for storing plans
			if (!context.workflowId) {
				return {
					success: false,
					error:
						"No workflow context - submit_plan can only be used in workflow sessions",
				};
			}

			// Get database connection
			const db = await getProjectDb(context.projectRoot);

			const now = Date.now();
			const planId = generatePlanId();

			try {
				// Insert the plan into the database
				await db
					.insertInto("plans")
					.values({
						id: planId,
						workflow_id: context.workflowId,
						approach_summary: input.approachSummary,
						pulses_json: JSON.stringify(input.pulses),
						created_at: now,
					})
					.execute();

				// Notify the workflow orchestrator about the tool result
				// This will set the workflow to awaiting_approval state and broadcast the event
				const orchestrator = getWorkflowOrchestrator();
				await orchestrator.handleToolResult(
					context.workflowId,
					"submit_plan",
					planId,
				);

				return {
					success: true,
					data: {
						success: true,
						plan_id: planId,
						message:
							"Execution plan submitted successfully. Awaiting user approval before proceeding to execution phase.",
					},
				};
			} catch (err) {
				return {
					success: false,
					error: `Failed to submit plan: ${err instanceof Error ? err.message : "unknown error"}`,
				};
			}
		},
	};
