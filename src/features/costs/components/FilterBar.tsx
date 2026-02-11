/**
 * FilterBar - Filter controls for the cost dashboard
 *
 * Horizontal bar with date range inputs, model selector, granularity selector,
 * and a clear filters button. Each filter change updates the store and re-fetches.
 */

import { useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useCostStore } from "../store/costStore";

export function FilterBar() {
	const filters = useCostStore((s) => s.filters);
	const granularity = useCostStore((s) => s.granularity);
	const byModel = useCostStore((s) => s.byModel);
	const setFilters = useCostStore((s) => s.setFilters);
	const setGranularity = useCostStore((s) => s.setGranularity);
	const fetchAll = useCostStore((s) => s.fetchAll);

	const modelIds = (byModel.data ?? []).map((m) => m.modelId);

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

	function handleModelChange(value: string) {
		setFilters({ modelId: value === "all" ? undefined : value });
		debouncedFetchAll();
	}

	function handleGranularityChange(value: string) {
		setGranularity(value as "daily" | "weekly");
		debouncedFetchAll();
	}

	function handleClear() {
		setFilters({
			startDate: undefined,
			endDate: undefined,
			modelId: undefined,
			workflowId: undefined,
		});
		setGranularity("daily");
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

			<Select
				value={filters.modelId ?? "all"}
				onValueChange={handleModelChange}
			>
				<SelectTrigger>
					<SelectValue placeholder="All Models" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="all">All Models</SelectItem>
					{modelIds.map((id) => (
						<SelectItem key={id} value={id}>
							{id}
						</SelectItem>
					))}
				</SelectContent>
			</Select>

			<Select value={granularity} onValueChange={handleGranularityChange}>
				<SelectTrigger>
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="daily">Daily</SelectItem>
					<SelectItem value="weekly">Weekly</SelectItem>
				</SelectContent>
			</Select>

			<Button variant="outline" size="sm" onClick={handleClear}>
				Clear Filters
			</Button>
		</div>
	);
}
