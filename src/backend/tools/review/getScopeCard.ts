/**
 * get_scope_card - Retrieve the approved scope card for the current workflow
 */

import { z } from "zod";
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
Returns the scope definition including in-scope items, out-of-scope items,
and constraints. Use this to verify changes align with the approved scope.`,
	inputSchema: getScopeCardInputSchema,
	execute: async (_input, _context): Promise<ToolResult> => {
		return {
			success: false,
			output: "Error: Scope card not found",
		};
	},
};
