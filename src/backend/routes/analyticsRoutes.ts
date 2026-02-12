/**
 * Analytics API Routes
 *
 * Routes for querying workflow analytics: success/failure rates,
 * stage durations, failure patterns, and throughput.
 */

import { ZodError } from "zod";
import type {
	AnalyticsFilters,
	FailurePatterns,
	StageDuration,
	SuccessFailureRate,
	Throughput,
} from "@/shared/schemas/analytics";
import { AnalyticsFiltersSchema } from "@/shared/schemas/analytics";
import { log } from "../logger";
import { getRepositories } from "../repositories";
import { AnalyticsValidationError } from "../repositories/AnalyticsRepository";

// =============================================================================
// Helpers
// =============================================================================

/**
 * Parse analytics filter query params from the request URL.
 */
function parseFilters(req: Request): AnalyticsFilters {
	const url = new URL(req.url);
	const params = url.searchParams;

	const filterObj: Record<string, string> = {};
	const startDate = params.get("startDate");
	const endDate = params.get("endDate");
	if (startDate) filterObj.startDate = startDate;
	if (endDate) filterObj.endDate = endDate;

	return AnalyticsFiltersSchema.parse(filterObj);
}

/**
 * Handle route errors, returning 400 for validation errors and 500 for others.
 */
function handleError(error: unknown, context: string): Response {
	if (error instanceof ZodError) {
		return Response.json({ error: error.issues }, { status: 400 });
	}
	if (error instanceof AnalyticsValidationError) {
		return Response.json({ error: error.message }, { status: 400 });
	}
	log.api.error(`Failed to get ${context}:`, error);
	return Response.json(
		{ error: error instanceof Error ? error.message : "Unknown error" },
		{ status: 500 },
	);
}

// =============================================================================
// Routes
// =============================================================================

export const analyticsRoutes = {
	"/api/analytics/summary": {
		async GET(req: Request) {
			try {
				const filters = parseFilters(req);
				const result =
					await getRepositories().analytics.getSuccessFailureRates(filters);
				return Response.json(result satisfies SuccessFailureRate);
			} catch (error) {
				return handleError(error, "analytics summary");
			}
		},
	},

	"/api/analytics/stages": {
		async GET(req: Request) {
			try {
				const filters = parseFilters(req);
				const result =
					await getRepositories().analytics.getStageDurations(filters);
				return Response.json(result satisfies StageDuration);
			} catch (error) {
				return handleError(error, "stage durations");
			}
		},
	},

	"/api/analytics/failures": {
		async GET(req: Request) {
			try {
				const filters = parseFilters(req);
				const result =
					await getRepositories().analytics.getFailurePatterns(filters);
				return Response.json(result satisfies FailurePatterns);
			} catch (error) {
				return handleError(error, "failure patterns");
			}
		},
	},

	"/api/analytics/throughput": {
		async GET(req: Request) {
			try {
				const filters = parseFilters(req);
				const result = await getRepositories().analytics.getThroughput(filters);
				return Response.json(result satisfies Throughput);
			} catch (error) {
				return handleError(error, "throughput");
			}
		},
	},
};
