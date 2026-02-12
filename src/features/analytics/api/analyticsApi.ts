import {
	type AnalyticsFilters,
	type FailurePatterns,
	FailurePatternsSchema,
	type StageDuration,
	StageDurationSchema,
	type SuccessFailureRate,
	SuccessFailureRateSchema,
	type Throughput,
	ThroughputSchema,
} from "@/shared/schemas/analytics";

// =============================================================================
// Helpers
// =============================================================================

/**
 * Build URLSearchParams from non-undefined filter values.
 */
function buildFilterParams(filters: AnalyticsFilters): URLSearchParams {
	const params = new URLSearchParams();
	if (filters.startDate !== undefined)
		params.set("startDate", filters.startDate);
	if (filters.endDate !== undefined) params.set("endDate", filters.endDate);
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
 * Fetch success/failure rate summary.
 */
export async function fetchSummary(
	filters: AnalyticsFilters,
): Promise<SuccessFailureRate> {
	const url = buildUrl("/api/analytics/summary", buildFilterParams(filters));
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error("Failed to fetch analytics summary");
	}
	const data = await response.json();
	return SuccessFailureRateSchema.parse(data);
}

/**
 * Fetch stage duration metrics.
 */
export async function fetchStages(
	filters: AnalyticsFilters,
): Promise<StageDuration> {
	const url = buildUrl("/api/analytics/stages", buildFilterParams(filters));
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error("Failed to fetch stage durations");
	}
	const data = await response.json();
	return StageDurationSchema.parse(data);
}

/**
 * Fetch failure pattern analysis.
 */
export async function fetchFailures(
	filters: AnalyticsFilters,
): Promise<FailurePatterns> {
	const url = buildUrl("/api/analytics/failures", buildFilterParams(filters));
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error("Failed to fetch failure patterns");
	}
	const data = await response.json();
	return FailurePatternsSchema.parse(data);
}

/**
 * Fetch workflow throughput over time.
 */
export async function fetchThroughput(
	filters: AnalyticsFilters,
): Promise<Throughput> {
	const url = buildUrl("/api/analytics/throughput", buildFilterParams(filters));
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error("Failed to fetch throughput");
	}
	const data = await response.json();
	return ThroughputSchema.parse(data);
}
