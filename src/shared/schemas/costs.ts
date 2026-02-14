import { z } from "zod";
import type { ModelScenario } from "./settings";

// =============================================================================
// Cost Filters
// =============================================================================

export const CostFiltersSchema = z.object({
	startDate: z.string().optional(),
	endDate: z.string().optional(),
	modelId: z.string().optional(),
	workflowId: z.string().optional(),
});
export type CostFilters = z.infer<typeof CostFiltersSchema>;

// =============================================================================
// Cost Summary
// =============================================================================

export const CostSummarySchema = z.object({
	totalCost: z.number(),
	promptTokens: z.number(),
	completionTokens: z.number(),
	count: z.number(),
});
export type CostSummary = z.infer<typeof CostSummarySchema>;

// =============================================================================
// Cost By Model
// =============================================================================

export const CostByModelSchema = z.array(
	z.object({
		modelId: z.string(),
		totalCost: z.number(),
		promptTokens: z.number(),
		completionTokens: z.number(),
	}),
);
export type CostByModel = z.infer<typeof CostByModelSchema>;

// =============================================================================
// Cost By Role
// =============================================================================

export const CostByRoleSchema = z.array(
	z.object({
		agentRole: z.string(),
		totalCost: z.number(),
		promptTokens: z.number(),
		completionTokens: z.number(),
	}),
);
export type CostByRole = z.infer<typeof CostByRoleSchema>;

// =============================================================================
// Cost Trend
// =============================================================================

export const CostTrendSchema = z.array(
	z.object({
		date: z.string(),
		totalCost: z.number(),
		count: z.number(),
	}),
);
export type CostTrend = z.infer<typeof CostTrendSchema>;

// =============================================================================
// Cost Token Usage
// =============================================================================

export const CostTokenUsageSchema = z.array(
	z.object({
		modelId: z.string(),
		uncachedPromptTokens: z.number(),
		cacheReadTokens: z.number(),
		cacheWriteTokens: z.number(),
		completionTokens: z.number(),
	}),
);
export type CostTokenUsage = z.infer<typeof CostTokenUsageSchema>;

// =============================================================================
// Cost By Workflow
// =============================================================================

export const CostByWorkflowSchema = z.array(
	z.object({
		workflowId: z.string(),
		workflowTitle: z.string().nullable(),
		totalCost: z.number(),
		promptTokens: z.number(),
		completionTokens: z.number(),
		count: z.number(),
	}),
);
export type CostByWorkflow = z.infer<typeof CostByWorkflowSchema>;

// =============================================================================
// Role Display Labels
// =============================================================================

export const ROLE_DISPLAY_LABELS: Record<ModelScenario, string> = {
	basic: "Basic",
	discussion: "Discussion",
	scoping: "Scoping",
	research: "Research",
	planning: "Planning",
	execution: "Execution",
	review: "Review",
	roadmap_planning: "Roadmap Planning",
};

// =============================================================================
// Time Range Presets
// =============================================================================

export type TimeRangePreset =
	| "today"
	| "yesterday"
	| "last7"
	| "last30"
	| "last90"
	| "all";

export const PRESET_LABELS: Record<TimeRangePreset, string> = {
	today: "Today",
	yesterday: "Yesterday",
	last7: "Last 7 Days",
	last30: "Last 30 Days",
	last90: "Last 90 Days",
	all: "All Time",
};

// =============================================================================
// Agent Role Display Labels
// =============================================================================

export const AGENT_ROLE_DISPLAY_LABELS: Record<string, string> = {
	...ROLE_DISPLAY_LABELS,
	preflight: "Preflight",
	review_sub: "Review Sub",
	roadmap_planning: "Roadmap Planning",
};
