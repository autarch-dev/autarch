/**
 * CostDashboardPage - Main cost analytics dashboard
 *
 * Reads URL query params on mount to initialize filters, then fetches all
 * cost data. Composes FilterBar and SummaryCard into a responsive layout.
 */

import { useEffect } from "react";
import { useSearch } from "wouter";
import { useCostStore } from "../store/costStore";
import { FilterBar } from "./FilterBar";
import { ModelBreakdownChart } from "./ModelBreakdownChart";
import { RoleBreakdownChart } from "./RoleBreakdownChart";
import { SummaryCard } from "./SummaryCard";
import { TokenUsageChart } from "./TokenUsageChart";
import { TrendChart } from "./TrendChart";
import { WorkflowCostTable } from "./WorkflowCostTable";

/** Parse filter values from a URL search string */
function parseFiltersFromSearch(search: string) {
	const params = new URLSearchParams(search);
	const filters: Record<string, string> = {};

	const workflowId = params.get("workflowId");
	if (workflowId) filters.workflowId = workflowId;

	const startDate = params.get("startDate");
	if (startDate) filters.startDate = startDate;

	const endDate = params.get("endDate");
	if (endDate) filters.endDate = endDate;

	const modelId = params.get("modelId");
	if (modelId) filters.modelId = modelId;

	return filters;
}

export function CostDashboardPage() {
	const setFilters = useCostStore((s) => s.setFilters);
	const fetchAll = useCostStore((s) => s.fetchAll);
	const search = useSearch();

	useEffect(() => {
		const filters = parseFiltersFromSearch(search);
		if (Object.keys(filters).length > 0) {
			setFilters(filters);
		}
		fetchAll();
	}, [search, setFilters, fetchAll]);

	return (
		<div className="flex flex-col gap-6 p-6 overflow-auto h-full">
			<h1 className="text-2xl font-bold tracking-tight">Cost Dashboard</h1>
			<FilterBar />
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
				<SummaryCard />
			</div>
			<div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
				<ModelBreakdownChart />
				<TrendChart />
				<TokenUsageChart />
				<RoleBreakdownChart />
			</div>
			<WorkflowCostTable />
		</div>
	);
}
