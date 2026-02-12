/**
 * FilterBar - Filter controls for the analytics dashboard
 *
 * Horizontal bar with date range inputs and a clear filters button.
 * Each filter change updates the store and re-fetches.
 */

import { useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useAnalyticsStore } from "../store/analyticsStore";

export function FilterBar() {
	const filters = useAnalyticsStore((s) => s.filters);
	const setFilters = useAnalyticsStore((s) => s.setFilters);
	const fetchAll = useAnalyticsStore((s) => s.fetchAll);

	/** Debounced fetchAll — batches rapid filter changes into a single fetch cycle */
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const debouncedFetchAll = useCallback(() => {
		if (timerRef.current) clearTimeout(timerRef.current);
		timerRef.current = setTimeout(() => {
			fetchAll();
		}, 300);
	}, [fetchAll]);

	function handleStartDateChange(e: React.ChangeEvent<HTMLInputElement>) {
		setFilters({ startDate: e.target.value || undefined });
		debouncedFetchAll();
	}

	function handleEndDateChange(e: React.ChangeEvent<HTMLInputElement>) {
		setFilters({ endDate: e.target.value || undefined });
		debouncedFetchAll();
	}

	function handleClear() {
		setFilters({
			startDate: undefined,
			endDate: undefined,
		});
		debouncedFetchAll();
	}

	return (
		<div className="flex flex-wrap items-center gap-3">
			<input
				type="date"
				value={filters.startDate ?? ""}
				onChange={handleStartDateChange}
				className="h-9 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs"
				aria-label="Start date"
			/>
			<input
				type="date"
				value={filters.endDate ?? ""}
				onChange={handleEndDateChange}
				className="h-9 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs"
				aria-label="End date"
			/>

			<Button variant="outline" size="sm" onClick={handleClear}>
				Clear Filters
			</Button>
		</div>
	);
}
