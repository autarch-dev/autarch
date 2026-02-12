/**
 * Analytics API Routes
 *
 * Routes for querying workflow analytics: success/failure rates,
 * stage durations, failure patterns, and throughput.
 */

import { AnalyticsFiltersSchema } from "@/shared/schemas/analytics";
import { log } from "../logger";
import { getRepositories } from "../repositories";

// =============================================================================
// Routes
// =============================================================================

export const analyticsRoutes = {
	"/api/analytics/summary": {
		async GET(req: Request) {
			try {
				const searchParams = new URL(req.url).searchParams;
				const filterObj: Record<string, string> = {};
				const startDate = searchParams.get("startDate");
				const endDate = searchParams.get("endDate");
				if (startDate) filterObj.startDate = startDate;
				if (endDate) filterObj.endDate = endDate;

				const filters = AnalyticsFiltersSchema.parse(filterObj);
				const result =
					await getRepositories().analytics.getSuccessFailureRates(filters);
				return Response.json(result);
			} catch (error) {
				log.api.error("Failed to get analytics summary:", error);
				return Response.json(
					{ error: error instanceof Error ? error.message : "Unknown error" },
					{ status: 500 },
				);
			}
		},
	},

	"/api/analytics/stages": {
		async GET(req: Request) {
			try {
				const searchParams = new URL(req.url).searchParams;
				const filterObj: Record<string, string> = {};
				const startDate = searchParams.get("startDate");
				const endDate = searchParams.get("endDate");
				if (startDate) filterObj.startDate = startDate;
				if (endDate) filterObj.endDate = endDate;

				const filters = AnalyticsFiltersSchema.parse(filterObj);
				const result =
					await getRepositories().analytics.getStageDurations(filters);
				return Response.json(result);
			} catch (error) {
				log.api.error("Failed to get stage durations:", error);
				return Response.json(
					{ error: error instanceof Error ? error.message : "Unknown error" },
					{ status: 500 },
				);
			}
		},
	},

	"/api/analytics/failures": {
		async GET(req: Request) {
			try {
				const searchParams = new URL(req.url).searchParams;
				const filterObj: Record<string, string> = {};
				const startDate = searchParams.get("startDate");
				const endDate = searchParams.get("endDate");
				if (startDate) filterObj.startDate = startDate;
				if (endDate) filterObj.endDate = endDate;

				const filters = AnalyticsFiltersSchema.parse(filterObj);
				const result =
					await getRepositories().analytics.getFailurePatterns(filters);
				return Response.json(result);
			} catch (error) {
				log.api.error("Failed to get failure patterns:", error);
				return Response.json(
					{ error: error instanceof Error ? error.message : "Unknown error" },
					{ status: 500 },
				);
			}
		},
	},

	"/api/analytics/throughput": {
		async GET(req: Request) {
			try {
				const searchParams = new URL(req.url).searchParams;
				const filterObj: Record<string, string> = {};
				const startDate = searchParams.get("startDate");
				const endDate = searchParams.get("endDate");
				if (startDate) filterObj.startDate = startDate;
				if (endDate) filterObj.endDate = endDate;

				const filters = AnalyticsFiltersSchema.parse(filterObj);
				const result = await getRepositories().analytics.getThroughput(filters);
				return Response.json(result);
			} catch (error) {
				log.api.error("Failed to get throughput:", error);
				return Response.json(
					{ error: error instanceof Error ? error.message : "Unknown error" },
					{ status: 500 },
				);
			}
		},
	},
};
