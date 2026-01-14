/**
 * submit_scope - Submit a finalized scope card for user approval
 */

import { z } from "zod";
import type { ToolDefinition, ToolResult } from "../types";

// =============================================================================
// Schema
// =============================================================================

export const submitScopeInputSchema = z.object({
	title: z.string().describe("Brief title of what this scope covers"),
	description: z
		.string()
		.describe("A few sentences describing the scope in detail"),
	in_scope: z.array(z.string()).describe("List of items explicitly in scope"),
	out_of_scope: z
		.array(z.string())
		.describe("List of items explicitly out of scope"),
	constraints: z
		.array(z.string())
		.optional()
		.describe("List of binding constraints that must not be violated"),
	recommended_path: z
		.enum(["quick", "full"])
		.describe("Recommended workflow path"),
	rationale: z
		.string()
		.optional()
		.describe("Explanation of why the recommended path was chosen"),
});

export type SubmitScopeInput = z.infer<typeof submitScopeInputSchema>;

export interface SubmitScopeOutput {
	success: boolean;
	scope_card_id: string;
}

// =============================================================================
// Tool Definition
// =============================================================================

export const submitScopeTool: ToolDefinition<
	SubmitScopeInput,
	SubmitScopeOutput
> = {
	name: "submit_scope",
	description: `Submit a finalized scope card for user approval.
Use when all Four Pillars (outcome, boundaries, constraints, success criteria) are clearly defined.
After submitting, the workflow will await user approval before transitioning to research.`,
	inputSchema: submitScopeInputSchema,
	execute: async (_input, _context): Promise<ToolResult<SubmitScopeOutput>> => {
		return {
			success: false,
			error: "submit_scope not implemented",
		};
	},
};
