/**
 * AnalyticsDashboardPage - Main workflow analytics dashboard
 *
 * Reads URL query params on mount to initialize filters, then fetches all
 * analytics data. Composes FilterBar and chart cards into a responsive layout.
 */

import { BarChart3 } from "lucide-react";
import { useEffect } from "react";
import { Link, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
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
	const summary = useAnalyticsStore((s) => s.summary);
	const stages = useAnalyticsStore((s) => s.stages);
	const failures = useAnalyticsStore((s) => s.failures);
	const throughput = useAnalyticsStore((s) => s.throughput);
	const search = useSearch();

	const isAnyLoading =
		summary.loading || stages.loading || failures.loading || throughput.loading;
	const isEmpty =
		!isAnyLoading && summary.data !== null && summary.data.length === 0;

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
			{summary.loading && summary.data === null ? (
				<p className="text-muted-foreground text-center py-8">
					Loading analytics...
				</p>
			) : isEmpty ? (
				<div className="px-4 py-8 text-center">
					<div className="size-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
						<BarChart3 className="size-6 text-muted-foreground" />
					</div>
					<h4 className="font-medium mb-1">No analytics data yet</h4>
					<p className="text-sm text-muted-foreground max-w-sm mx-auto">
						Analytics are generated as workflows complete. You&apos;ll see
						success rates, stage durations, failure patterns, and throughput
						here.
					</p>
					<div className="mt-4 flex items-center justify-center gap-2">
						<Button asChild>
							<Link to="/">Go to Dashboard</Link>
						</Button>
					</div>
				</div>
			) : (
				<>
					<FilterBar />
					<div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
						<SuccessFailureCard />
						<StageDurationCard />
						<FailurePatternCard />
						<ThroughputCard />
					</div>
				</>
			)}
		</div>
	);
}
