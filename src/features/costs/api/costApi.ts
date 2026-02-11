import {
	type CostByModel,
	CostByModelSchema,
	type CostByRole,
	CostByRoleSchema,
	type CostByWorkflow,
	CostByWorkflowSchema,
	type CostFilters,
	type CostSummary,
	CostSummarySchema,
	type CostTokenUsage,
	CostTokenUsageSchema,
	type CostTrend,
	CostTrendSchema,
} from "@/shared/schemas/costs";

// =============================================================================
// Helpers
// =============================================================================

/**
 * Build URLSearchParams from non-undefined filter values.
 */
function buildFilterParams(filters: CostFilters): URLSearchParams {
	const params = new URLSearchParams();
	if (filters.startDate !== undefined)
		params.set("startDate", filters.startDate);
	if (filters.endDate !== undefined) params.set("endDate", filters.endDate);
	if (filters.modelId !== undefined) params.set("modelId", filters.modelId);
	if (filters.workflowId !== undefined)
		params.set("workflowId", filters.workflowId);
	return params;
}

/**
 * Build a URL with optional query params.
 */
function buildUrl(path: string, params: URLSearchParams): string {
	const query = params.toString();
	return query ? `${path}?${query}` : path;
}

// =============================================================================
// API Functions
// =============================================================================

/**
 * Fetch cost summary (totals).
 */
export async function fetchCostSummary(
	filters: CostFilters,
): Promise<CostSummary> {
	const url = buildUrl("/api/costs/summary", buildFilterParams(filters));
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error("Failed to fetch cost summary");
	}
	const data = await response.json();
	return CostSummarySchema.parse(data);
}

/**
 * Fetch cost breakdown by model.
 */
export async function fetchCostByModel(
	filters: CostFilters,
): Promise<CostByModel> {
	const url = buildUrl("/api/costs/by-model", buildFilterParams(filters));
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error("Failed to fetch cost by model");
	}
	const data = await response.json();
	return CostByModelSchema.parse(data);
}

/**
 * Fetch cost breakdown by agent role.
 */
export async function fetchCostByRole(
	filters: CostFilters,
): Promise<CostByRole> {
	const url = buildUrl("/api/costs/by-role", buildFilterParams(filters));
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error("Failed to fetch cost by role");
	}
	const data = await response.json();
	return CostByRoleSchema.parse(data);
}

/**
 * Fetch cost trends over time.
 */
export async function fetchCostTrends(
	filters: CostFilters,
	granularity: "daily" | "weekly",
): Promise<CostTrend> {
	const params = buildFilterParams(filters);
	params.set("granularity", granularity);
	const url = buildUrl("/api/costs/trends", params);
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error("Failed to fetch cost trends");
	}
	const data = await response.json();
	return CostTrendSchema.parse(data);
}

/**
 * Fetch token usage breakdown by model.
 */
export async function fetchCostTokenUsage(
	filters: CostFilters,
): Promise<CostTokenUsage> {
	const url = buildUrl("/api/costs/token-usage", buildFilterParams(filters));
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error("Failed to fetch token usage");
	}
	const data = await response.json();
	return CostTokenUsageSchema.parse(data);
}

/**
 * Fetch cost breakdown by workflow.
 */
export async function fetchCostByWorkflow(
	filters: CostFilters,
): Promise<CostByWorkflow> {
	const url = buildUrl("/api/costs/by-workflow", buildFilterParams(filters));
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error("Failed to fetch cost by workflow");
	}
	const data = await response.json();
	return CostByWorkflowSchema.parse(data);
}
