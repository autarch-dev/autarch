/**
 * KnowledgeFilterBar - Secondary filter controls for the knowledge page
 *
 * Compact row with workflow ID input, date range pickers, archived toggle,
 * and a clear-all button. The search and category filters are managed by
 * the parent KnowledgePage.
 */

import { Tag, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { fetchKnowledgeTags } from "../api/knowledgeApi";
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

	const [availableTags, setAvailableTags] = useState<string[]>([]);
	const [searchText, setSearchText] = useState("");
	const [popoverOpen, setPopoverOpen] = useState(false);

	const selectedTags = filters.tags?.split(",").filter(Boolean) ?? [];

	useEffect(() => {
		fetchKnowledgeTags()
			.then(setAvailableTags)
			.catch(() => setAvailableTags([]));
	}, []);

	const filteredTags = availableTags.filter((t) =>
		t.toLowerCase().includes(searchText.toLowerCase()),
	);

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

	function handleTagToggle(tag: string) {
		const newTags = selectedTags.includes(tag)
			? selectedTags.filter((t) => t !== tag)
			: [...selectedTags, tag];
		setFilters({
			tags: newTags.length > 0 ? newTags.join(",") : undefined,
			offset: 0,
		});
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

			{/* Tags */}
			<Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
				<PopoverTrigger asChild>
					<Button variant="outline" size="sm" className="h-8 text-xs">
						<Tag className="size-3.5 mr-1.5" />
						Tags
						{selectedTags.length > 0 && (
							<Badge variant="secondary" className="ml-1 px-1.5 py-0.5 text-xs">
								{selectedTags.length}
							</Badge>
						)}
					</Button>
				</PopoverTrigger>
				<PopoverContent className="w-64 p-3" align="start">
					<Input
						placeholder="Search tags..."
						value={searchText}
						onChange={(e) => setSearchText(e.target.value)}
						className="mb-2 h-8 text-sm"
					/>
					<ScrollArea className="max-h-48">
						{filteredTags.length > 0 ? (
							filteredTags.map((tag) => (
								<div key={tag} className="flex items-center gap-2 py-1">
									<Checkbox
										id={`tag-${tag}`}
										checked={selectedTags.includes(tag)}
										onCheckedChange={() => handleTagToggle(tag)}
										className="size-3.5"
									/>
									<Label
										htmlFor={`tag-${tag}`}
										className="text-sm cursor-pointer"
									>
										{tag}
									</Label>
								</div>
							))
						) : (
							<p className="text-xs text-muted-foreground py-2 text-center">
								No tags found
							</p>
						)}
					</ScrollArea>
				</PopoverContent>
			</Popover>

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
