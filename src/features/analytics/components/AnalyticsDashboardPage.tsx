/**
 * AnalyticsDashboardPage - Main workflow analytics dashboard
 *
 * Reads URL query params on mount to initialize filters, then fetches all
 * analytics data. Composes FilterBar and chart cards into a responsive layout.
 */

import { useEffect } from "react";
import { useSearch } from "wouter";
import { useAnalyticsStore } from "../store/analyticsStore";
import { FailurePatternCard } from "./FailurePatternCard";
import { FilterBar } from "./FilterBar";
import { StageDurationCard } from "./StageDurationCard";
import { SuccessFailureCard } from "./SuccessFailureCard";
import { ThroughputCard } from "./ThroughputCard";

/** Parse filter values from a URL search string */
function parseFiltersFromSearch(search: string) {
	const params = new URLSearchParams(search);
	const filters: Record<string, string> = {};

	const startDate = params.get("startDate");
	if (startDate) filters.startDate = startDate;

	const endDate = params.get("endDate");
	if (endDate) filters.endDate = endDate;

	return filters;
}

export function AnalyticsDashboardPage() {
	const setFilters = useAnalyticsStore((s) => s.setFilters);
	const fetchAll = useAnalyticsStore((s) => s.fetchAll);
	const search = useSearch();

	useEffect(() => {
		const filters = parseFiltersFromSearch(search);
		// Replace filters entirely rather than merge
		setFilters({
			startDate: undefined,
			endDate: undefined,
			...filters,
		});
		fetchAll();
	}, [search, setFilters, fetchAll]);

	return (
		<div className="flex flex-col gap-6 p-6 overflow-auto h-full">
			<h1 className="text-2xl font-bold tracking-tight">Workflow Analytics</h1>
			<FilterBar />
			<div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
				<SuccessFailureCard />
				<StageDurationCard />
				<FailurePatternCard />
				<ThroughputCard />
			</div>
		</div>
	);
}
