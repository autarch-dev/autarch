/**
 * submit_scope - Submit a finalized scope card for user approval
 *
 * Persists the scope card to the database and triggers the approval workflow.
 * The workflow will await user approval before transitioning to the research phase.
 */

import { z } from "zod";
import { getWorkflowOrchestrator } from "@/backend/agents/runner";
import { getProjectDb } from "@/backend/db/project";
import { ids } from "@/backend/utils";
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

// =============================================================================
// Tool Definition
// =============================================================================

export const submitScopeTool: ToolDefinition<SubmitScopeInput> = {
	name: "submit_scope",
	description: `Submit a finalized scope card for user approval.
Use when all Four Pillars (outcome, boundaries, constraints, success criteria) are clearly defined.
After submitting, the workflow will await user approval before transitioning to research.`,
	inputSchema: submitScopeInputSchema,
	execute: async (input, context): Promise<ToolResult> => {
		// Workflow ID is required for storing scope cards
		if (!context.workflowId) {
			return {
				success: false,
				output:
					"Error: No workflow context - submit_scope can only be used in workflow sessions",
			};
		}

		// Get database connection
		const db = await getProjectDb(context.projectRoot);

		const now = Date.now();
		const scopeCardId = ids.scopeCard();

		try {
			// Insert the scope card into the database
			await db
				.insertInto("scope_cards")
				.values({
					id: scopeCardId,
					workflow_id: context.workflowId,
					title: input.title,
					description: input.description,
					in_scope_json: JSON.stringify(input.in_scope),
					out_of_scope_json: JSON.stringify(input.out_of_scope),
					constraints_json: input.constraints
						? JSON.stringify(input.constraints)
						: null,
					recommended_path: input.recommended_path,
					rationale: input.rationale ?? null,
					status: "pending",
					created_at: now,
				})
				.execute();

			// Notify the workflow orchestrator about the tool result
			// This will set the workflow to awaiting_approval state and broadcast the event
			const orchestrator = getWorkflowOrchestrator();
			await orchestrator.handleToolResult(
				context.workflowId,
				"submit_scope",
				scopeCardId,
			);

			return {
				success: true,
				output:
					"Scope card submitted successfully. Wait for the user to approve the scope.",
			};
		} catch (err) {
			return {
				success: false,
				output: `Error: Failed to submit scope card: ${err instanceof Error ? err.message : "unknown error"}`,
			};
		}
	},
};
