/**
 * KnowledgeFilterBar - Secondary filter controls for the knowledge page
 *
 * Compact row with workflow ID input, date range pickers, archived toggle,
 * and a clear-all button. The search and category filters are managed by
 * the parent KnowledgePage.
 */

import { X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useKnowledgeStore } from "../store/knowledgeStore";

// =============================================================================
// Props
// =============================================================================

export interface KnowledgeFilterBarProps {
	debouncedFetch: () => void;
	onClearAll: () => void;
	hasActiveFilters: boolean;
}

// =============================================================================
// Component
// =============================================================================

export function KnowledgeFilterBar({
	debouncedFetch,
	onClearAll,
	hasActiveFilters,
}: KnowledgeFilterBarProps) {
	const filters = useKnowledgeStore((s) => s.filters);
	const setFilters = useKnowledgeStore((s) => s.setFilters);

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

	/** Convert epoch ms back to YYYY-MM-DD for the native date input */
	function epochToDateString(ms: number | undefined): string {
		if (ms == null) return "";
		const d = new Date(ms);
		return d.toISOString().slice(0, 10);
	}

	const inputClass =
		"h-8 rounded-md border border-input bg-transparent px-2.5 py-1 text-xs shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

	return (
		<div className="flex items-center gap-2.5 flex-wrap min-w-0">
			{/* Workflow ID */}
			<input
				type="text"
				placeholder="Workflow ID"
				value={filters.workflowId ?? ""}
				onChange={handleWorkflowIdChange}
				className={`${inputClass} w-36`}
				aria-label="Workflow ID"
			/>

			{/* Date range */}
			<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
				<span>From</span>
				<input
					type="date"
					value={epochToDateString(filters.startDate)}
					onChange={handleStartDateChange}
					className={inputClass}
					aria-label="Start date"
				/>
				<span>to</span>
				<input
					type="date"
					value={epochToDateString(filters.endDate)}
					onChange={handleEndDateChange}
					className={inputClass}
					aria-label="End date"
				/>
			</div>

			{/* Archived toggle */}
			<div className="flex items-center gap-1.5">
				<Checkbox
					id="knowledge-archived"
					checked={filters.archived === true}
					onCheckedChange={handleArchivedChange}
					className="size-3.5"
				/>
				<Label
					htmlFor="knowledge-archived"
					className="text-xs text-muted-foreground cursor-pointer"
				>
					Archived
				</Label>
			</div>

			{/* Clear all */}
			{hasActiveFilters && (
				<button
					type="button"
					onClick={onClearAll}
					className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
				>
					<X className="size-3" />
					Clear
				</button>
			)}
		</div>
	);
}
