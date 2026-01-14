/**
 * submit_plan - Submit an execution plan for user approval
 */

import { z } from "zod";
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
}

// =============================================================================
// Tool Definition
// =============================================================================

export const submitPlanTool: ToolDefinition<SubmitPlanInput, SubmitPlanOutput> =
	{
		name: "submit_plan",
		description: `Submit an execution plan for user approval.
Use after verifying research findings against the codebase.`,
		inputSchema: submitPlanInputSchema,
		execute: async (
			_input,
			_context,
		): Promise<ToolResult<SubmitPlanOutput>> => {
			return {
				success: false,
				error: "submit_plan not implemented",
			};
		},
	};
