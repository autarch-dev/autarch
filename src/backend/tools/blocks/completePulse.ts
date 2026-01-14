/**
 * complete_pulse - Signal pulse completion with a summary
 */

import { z } from "zod";
import type { ToolDefinition, ToolResult } from "../types";

// =============================================================================
// Schema
// =============================================================================

const unresolvedIssueSchema = z.object({
	issue: z.string(),
	reason: z.string(),
});

export const completePulseInputSchema = z.object({
	summary: z
		.string()
		.describe(
			'Conventional commit message (e.g., "feat(auth): implement login flow")',
		),
	filesChanged: z
		.array(z.string())
		.describe("List of file paths that were modified"),
	unresolvedIssues: z
		.array(unresolvedIssueSchema)
		.optional()
		.describe("Acknowledged issues that couldn't be fixed (escape hatch)"),
});

export type CompletePulseInput = z.infer<typeof completePulseInputSchema>;

export interface CompletePulseOutput {
	success: boolean;
}

// =============================================================================
// Tool Definition
// =============================================================================

export const completePulseTool: ToolDefinition<
	CompletePulseInput,
	CompletePulseOutput
> = {
	name: "complete_pulse",
	description: `Signal pulse completion with a summary suitable for commit message.
Only use when ALL pulse requirements are satisfied — code complete and clean.
The summary field becomes the commit message. Format it as a Conventional Commit.`,
	inputSchema: completePulseInputSchema,
	execute: async (
		_input,
		_context,
	): Promise<ToolResult<CompletePulseOutput>> => {
		return {
			success: false,
			error: "complete_pulse not implemented",
		};
	},
};
