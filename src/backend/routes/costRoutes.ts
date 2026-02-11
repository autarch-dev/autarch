/**
 * Cost API Routes
 *
 * Routes for cost analytics: summary, breakdowns by model/role/workflow,
 * trends over time, and token usage.
 * Uses CostRecordRepository for data access.
 */

import { log } from "../logger";
import { getRepositories } from "../repositories";
import type { CostRecordFilters } from "../repositories/CostRecordRepository";

// =============================================================================
// Helpers
// =============================================================================

/**
 * Parse cost filter query params from the request URL.
 */
function parseFilters(req: Request): CostRecordFilters {
	const url = new URL(req.url);
	const params = url.searchParams;

	const filters: CostRecordFilters = {};

	const startDate = params.get("startDate");
	if (startDate) filters.startDate = startDate;

	const endDate = params.get("endDate");
	if (endDate) filters.endDate = endDate;

	const modelId = params.get("modelId");
	if (modelId) filters.modelId = modelId;

	const workflowId = params.get("workflowId");
	if (workflowId) filters.workflowId = workflowId;

	return filters;
}

// =============================================================================
// Routes
// =============================================================================

export const costRoutes = {
	"/api/costs/summary": {
		async GET(req: Request) {
			try {
				const filters = parseFilters(req);
				const repos = getRepositories();
				const summary = await repos.costRecords.getSummary(filters);
				return Response.json(summary);
			} catch (error) {
				log.api.error("Failed to get cost summary:", error);
				return Response.json(
					{ error: error instanceof Error ? error.message : "Unknown error" },
					{ status: 500 },
				);
			}
		},
	},

	"/api/costs/by-model": {
		async GET(req: Request) {
			try {
				const filters = parseFilters(req);
				const repos = getRepositories();
				const data = await repos.costRecords.getByModel(filters);
				return Response.json(data);
			} catch (error) {
				log.api.error("Failed to get cost by model:", error);
				return Response.json(
					{ error: error instanceof Error ? error.message : "Unknown error" },
					{ status: 500 },
				);
			}
		},
	},

	"/api/costs/by-role": {
		async GET(req: Request) {
			try {
				const filters = parseFilters(req);
				const repos = getRepositories();
				const data = await repos.costRecords.getByRole(filters);
				return Response.json(data);
			} catch (error) {
				log.api.error("Failed to get cost by role:", error);
				return Response.json(
					{ error: error instanceof Error ? error.message : "Unknown error" },
					{ status: 500 },
				);
			}
		},
	},

	"/api/costs/trends": {
		async GET(req: Request) {
			try {
				const filters = parseFilters(req);
				const url = new URL(req.url);
				const granularity =
					url.searchParams.get("granularity") === "weekly" ? "weekly" : "daily";
				const repos = getRepositories();
				const data = await repos.costRecords.getTrends(filters, granularity);
				return Response.json(data);
			} catch (error) {
				log.api.error("Failed to get cost trends:", error);
				return Response.json(
					{ error: error instanceof Error ? error.message : "Unknown error" },
					{ status: 500 },
				);
			}
		},
	},

	"/api/costs/tokens": {
		async GET(req: Request) {
			try {
				const filters = parseFilters(req);
				const repos = getRepositories();
				const data = await repos.costRecords.getTokenUsage(filters);
				return Response.json(data);
			} catch (error) {
				log.api.error("Failed to get token usage:", error);
				return Response.json(
					{ error: error instanceof Error ? error.message : "Unknown error" },
					{ status: 500 },
				);
			}
		},
	},

	"/api/costs/by-workflow": {
		async GET(req: Request) {
			try {
				const filters = parseFilters(req);
				const repos = getRepositories();
				const costData = await repos.costRecords.getByWorkflow(filters);

				// Enrich with workflow titles
				const workflows = await repos.workflows.list({ orderBy: "updated" });
				const titleMap = new Map(workflows.map((w) => [w.id, w.title]));

				const enriched = costData.map((row) => ({
					...row,
					workflowTitle: titleMap.get(row.workflowId) ?? null,
				}));

				return Response.json(enriched);
			} catch (error) {
				log.api.error("Failed to get cost by workflow:", error);
				return Response.json(
					{ error: error instanceof Error ? error.message : "Unknown error" },
					{ status: 500 },
				);
			}
		},
	},
};
