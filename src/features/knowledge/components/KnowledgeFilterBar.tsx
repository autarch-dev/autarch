/**
 * KnowledgeFilterBar - Filter controls for the knowledge management view
 *
 * Horizontal bar with search, category, workflowId, date range, archived toggle,
 * and a clear filters button. Each filter change updates the store and triggers
 * a debounced fetch (searchItems when search query is non-empty, fetchItems otherwise).
 */

import { useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { KnowledgeCategory } from "@/shared/schemas/knowledge";
import { useKnowledgeStore } from "../store/knowledgeStore";

export function KnowledgeFilterBar() {
	const filters = useKnowledgeStore((s) => s.filters);
	const setFilters = useKnowledgeStore((s) => s.setFilters);
	const fetchItems = useKnowledgeStore((s) => s.fetchItems);
	const searchQuery = useKnowledgeStore((s) => s.searchQuery);
	const setSearchQuery = useKnowledgeStore((s) => s.setSearchQuery);
	const searchItems = useKnowledgeStore((s) => s.searchItems);

	/** Debounced fetch — calls searchItems when a search query is present, fetchItems otherwise */
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		return () => {
			if (timerRef.current) clearTimeout(timerRef.current);
		};
	}, []);
	const debouncedFetch = useCallback(() => {
		if (timerRef.current) clearTimeout(timerRef.current);
		timerRef.current = setTimeout(() => {
			const query = useKnowledgeStore.getState().searchQuery;
			if (query.trim()) {
				searchItems();
			} else {
				fetchItems();
			}
		}, 300);
	}, [fetchItems, searchItems]);

	function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
		setSearchQuery(e.target.value);
		debouncedFetch();
	}

	function handleCategoryChange(e: React.ChangeEvent<HTMLSelectElement>) {
		const value = e.target.value;
		setFilters({
			category: value ? (value as KnowledgeCategory) : undefined,
			offset: 0,
		});
		debouncedFetch();
	}

	function handleWorkflowIdChange(e: React.ChangeEvent<HTMLInputElement>) {
		setFilters({ workflowId: e.target.value || undefined, offset: 0 });
		debouncedFetch();
	}

	function handleStartDateChange(e: React.ChangeEvent<HTMLInputElement>) {
		const ms = e.target.value ? Date.parse(e.target.value) : undefined;
		setFilters({ startDate: ms, offset: 0 });
		debouncedFetch();
	}

	function handleEndDateChange(e: React.ChangeEvent<HTMLInputElement>) {
		const ms = e.target.value ? Date.parse(e.target.value) : undefined;
		setFilters({ endDate: ms, offset: 0 });
		debouncedFetch();
	}

	function handleArchivedChange(checked: boolean | "indeterminate") {
		setFilters({ archived: checked === true ? true : undefined, offset: 0 });
		debouncedFetch();
	}

	function handleClear() {
		setFilters({
			category: undefined,
			workflowId: undefined,
			startDate: undefined,
			endDate: undefined,
			archived: undefined,
			offset: 0,
		});
		setSearchQuery("");
		fetchItems();
	}

	/** Convert epoch ms back to YYYY-MM-DD for the native date input */
	function epochToDateString(ms: number | undefined): string {
		if (ms == null) return "";
		const d = new Date(ms);
		return d.toISOString().slice(0, 10);
	}

	return (
		<div className="flex flex-wrap items-center gap-3">
			<Input
				type="text"
				placeholder="Search knowledge…"
				value={searchQuery}
				onChange={handleSearchChange}
				className="w-52"
				aria-label="Search knowledge"
			/>

			<select
				value={filters.category ?? ""}
				onChange={handleCategoryChange}
				className="h-9 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs"
				aria-label="Category"
			>
				<option value="">All categories</option>
				<option value="pattern">Pattern</option>
				<option value="gotcha">Gotcha</option>
				<option value="tool-usage">Tool Usage</option>
				<option value="process-improvement">Process Improvement</option>
			</select>

			<Input
				type="text"
				placeholder="Workflow ID"
				value={filters.workflowId ?? ""}
				onChange={handleWorkflowIdChange}
				className="w-44"
				aria-label="Workflow ID"
			/>

			<input
				type="date"
				value={epochToDateString(filters.startDate)}
				onChange={handleStartDateChange}
				className="h-9 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs"
				aria-label="Start date"
			/>
			<input
				type="date"
				value={epochToDateString(filters.endDate)}
				onChange={handleEndDateChange}
				className="h-9 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs"
				aria-label="End date"
			/>

			<div className="flex items-center gap-1.5">
				<Checkbox
					id="knowledge-archived"
					checked={filters.archived === true}
					onCheckedChange={handleArchivedChange}
				/>
				<Label htmlFor="knowledge-archived" className="text-sm">
					Archived
				</Label>
			</div>

			<Button variant="outline" size="sm" onClick={handleClear}>
				Clear Filters
			</Button>
		</div>
	);
}
