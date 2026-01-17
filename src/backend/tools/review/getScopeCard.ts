/**
 * get_scope_card - Retrieve the approved scope card for the current workflow
 */

import { z } from "zod";
import { getProjectDb } from "@/backend/db/project";
import { ArtifactRepository } from "@/backend/repositories";
import {
	REASON_DESCRIPTION,
	type ToolDefinition,
	type ToolResult,
} from "../types";

// =============================================================================
// Schema
// =============================================================================

export const getScopeCardInputSchema = z.object({
	reason: z.string().describe(REASON_DESCRIPTION),
});

export type GetScopeCardInput = z.infer<typeof getScopeCardInputSchema>;

// =============================================================================
// Tool Definition
// =============================================================================

export const getScopeCardTool: ToolDefinition<GetScopeCardInput> = {
	name: "get_scope_card",
	description: `Retrieve the approved scope card for the current workflow.
Returns only the title and description of the scope. Use this to understand
the high-level goals and verify changes align with the approved scope.`,
	inputSchema: getScopeCardInputSchema,
	execute: async (_input, context): Promise<ToolResult> => {
		// Validate workflow context
		if (!context.workflowId) {
			return {
				success: false,
				output:
					"Error: No workflow context - get_scope_card can only be used in workflow sessions",
			};
		}

		try {
			// Get database connection and repository
			const db = await getProjectDb(context.projectRoot);
			const artifactRepo = new ArtifactRepository(db);

			// Get the latest scope card for this workflow
			const scopeCard = await artifactRepo.getLatestScopeCard(
				context.workflowId,
			);

			if (!scopeCard) {
				return {
					success: false,
					output: `Error: No scope card found for workflow: ${context.workflowId}`,
				};
			}

			// Check if scope card is approved
			if (scopeCard.status !== "approved") {
				return {
					success: false,
					output: `Error: Scope card is not approved (status: ${scopeCard.status})`,
				};
			}

			// Return ONLY title and description per scope requirements
			const output = `# Scope Card

## Title
${scopeCard.title}

## Description
${scopeCard.description}`;

			return {
				success: true,
				output,
			};
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Unknown error occurred";
			return {
				success: false,
				output: `Error: Failed to get scope card - ${message}`,
			};
		}
	},
};
