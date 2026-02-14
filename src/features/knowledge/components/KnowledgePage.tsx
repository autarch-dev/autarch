/**
 * KnowledgePage - Main knowledge management page
 *
 * Reads URL query params on mount to initialize filters, then fetches
 * knowledge items. Lays out a prominent search bar, category quick-filters,
 * a secondary filter row, and either a card grid (Browse) or visual timeline.
 */

import {
	AlertCircle,
	BookOpen,
	ChevronLeft,
	ChevronRight,
	Clock,
	LayoutGrid,
	Search,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { KnowledgeCategory } from "@/shared/schemas/knowledge";
import { useKnowledgeStore } from "../store/knowledgeStore";
import { CATEGORY_CONFIG } from "../utils/format";
import { KnowledgeFilterBar } from "./KnowledgeFilterBar";
import { KnowledgeItemCard } from "./KnowledgeItemCard";
import { KnowledgeTimeline } from "./KnowledgeTimeline";

// =============================================================================
// Helpers
// =============================================================================

/** Parse filter values from a URL search string */
function parseFiltersFromSearch(search: string) {
	const params = new URLSearchParams(search);
	const filters: Record<string, string | number | boolean> = {};

	const category = params.get("category");
	if (category) filters.category = category;

	const workflowId = params.get("workflowId");
	if (workflowId) filters.workflowId = workflowId;

	const startDate = params.get("startDate");
	if (startDate) filters.startDate = Number(startDate);

	const endDate = params.get("endDate");
	if (endDate) filters.endDate = Number(endDate);

	const archived = params.get("archived");
	if (archived) filters.archived = archived === "true";

	const tags = params.get("tags");
	if (tags) filters.tags = tags;

	return filters;
}

const DEFAULT_PAGE_SIZE = 20;

const ALL_CATEGORIES: KnowledgeCategory[] = [
	"pattern",
	"gotcha",
	"tool-usage",
	"process-improvement",
];

// =============================================================================
// Component
// =============================================================================

export function KnowledgePage() {
	const setFilters = useKnowledgeStore((s) => s.setFilters);
	const fetchItems = useKnowledgeStore((s) => s.fetchItems);
	const items = useKnowledgeStore((s) => s.items);
	const searchQuery = useKnowledgeStore((s) => s.searchQuery);
	const setSearchQuery = useKnowledgeStore((s) => s.setSearchQuery);
	const searchItems = useKnowledgeStore((s) => s.searchItems);
	const searchResults = useKnowledgeStore((s) => s.searchResults);
	const filters = useKnowledgeStore((s) => s.filters);
	const search = useSearch();

	const [view, setView] = useState<"browse" | "timeline">("browse");

	// Derived state
	const isLoading = items.loading && items.data === null;
	const isError = !items.loading && items.data === null && items.error !== null;
	const hasData = items.data !== null;
	const hasActiveFilters =
		filters.category != null ||
		filters.workflowId != null ||
		filters.startDate != null ||
		filters.endDate != null ||
		filters.archived != null ||
		filters.tags != null;
	const isEmptyKnowledgeBase =
		!items.loading &&
		hasData &&
		items.data?.total === 0 &&
		!searchQuery &&
		!hasActiveFilters;
	const isSearchActive = searchQuery.length > 0;

	// Pagination
	const currentOffset = filters.offset ?? 0;
	const pageSize = filters.limit ?? DEFAULT_PAGE_SIZE;
	const totalItems = items.data?.total ?? 0;
	const currentPage = Math.floor(currentOffset / pageSize) + 1;
	const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
	const hasPreviousPage = currentOffset > 0;
	const hasNextPage = currentOffset + pageSize < totalItems;

	// -------------------------------------------------------------------------
	// Debounced fetch
	// -------------------------------------------------------------------------

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

	// -------------------------------------------------------------------------
	// Handlers
	// -------------------------------------------------------------------------

	useEffect(() => {
		const urlFilters = parseFiltersFromSearch(search);
		setFilters({
			category: undefined,
			workflowId: undefined,
			startDate: undefined,
			endDate: undefined,
			archived: undefined,
			...urlFilters,
		});
		fetchItems();
	}, [search, setFilters, fetchItems]);

	function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
		setSearchQuery(e.target.value);
		debouncedFetch();
	}

	function handleCategoryToggle(cat: KnowledgeCategory) {
		setFilters({
			category: filters.category === cat ? undefined : cat,
			offset: 0,
		});
		debouncedFetch();
	}

	function handleClearAll() {
		setFilters({
			category: undefined,
			workflowId: undefined,
			startDate: undefined,
			endDate: undefined,
			archived: undefined,
			tags: undefined,
			offset: 0,
		});
		setSearchQuery("");
		fetchItems();
	}

	function goToPage(page: number) {
		const newOffset = (page - 1) * pageSize;
		setFilters({ offset: newOffset });
		fetchItems();
	}

	// -------------------------------------------------------------------------
	// Render
	// -------------------------------------------------------------------------

	return (
		<div className="flex-1 overflow-auto">
			<div className="mx-auto max-w-5xl px-8 py-10 space-y-8">
				{/* Page header */}
				<div>
					<h1 className="text-2xl font-semibold tracking-tight">
						Knowledge Base
					</h1>
					<p className="text-sm text-muted-foreground mt-1">
						{totalItems > 0
							? `${totalItems} ${totalItems === 1 ? "item" : "items"} learned from your workflows`
							: "Patterns, gotchas, and insights extracted from workflows"}
					</p>
				</div>

				{/* Search bar */}
				<div className="relative">
					<Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground pointer-events-none" />
					<input
						type="text"
						placeholder="Search knowledge..."
						value={searchQuery}
						onChange={handleSearchChange}
						className="flex h-12 w-full rounded-xl border bg-transparent px-4 pl-12 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						aria-label="Search knowledge"
					/>
				</div>

				{/* Category quick-filter pills */}
				<div className="flex items-center gap-2 flex-wrap">
					{ALL_CATEGORIES.map((cat) => {
						const cfg = CATEGORY_CONFIG[cat];
						const isActive = filters.category === cat;
						return (
							<button
								key={cat}
								type="button"
								onClick={() => handleCategoryToggle(cat)}
								className={cn(
									"inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all",
									isActive
										? `${cfg.activeRing} ring-2 border-transparent`
										: "border-border hover:border-foreground/20 text-muted-foreground hover:text-foreground",
								)}
							>
								<span className={cn("size-2 rounded-full shrink-0", cfg.dot)} />
								{cfg.label}
							</button>
						);
					})}
				</div>

				{/* Secondary filters + view toggle */}
				<div className="flex items-center justify-between gap-4">
					<KnowledgeFilterBar
						debouncedFetch={debouncedFetch}
						onClearAll={handleClearAll}
						hasActiveFilters={hasActiveFilters || isSearchActive}
					/>

					<div className="flex items-center gap-1 shrink-0 rounded-lg border p-0.5">
						<button
							type="button"
							onClick={() => setView("browse")}
							className={cn(
								"rounded-md p-1.5 transition-colors",
								view === "browse"
									? "bg-muted text-foreground"
									: "text-muted-foreground hover:text-foreground",
							)}
							title="Grid view"
						>
							<LayoutGrid className="size-4" />
						</button>
						<button
							type="button"
							onClick={() => setView("timeline")}
							className={cn(
								"rounded-md p-1.5 transition-colors",
								view === "timeline"
									? "bg-muted text-foreground"
									: "text-muted-foreground hover:text-foreground",
							)}
							title="Timeline view"
						>
							<Clock className="size-4" />
						</button>
					</div>
				</div>

				{/* ---------- Content Area ---------- */}

				{/* Loading */}
				{isLoading && (
					<div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
						{[1, 2, 3, 4, 5, 6].map((i) => (
							<div
								key={i}
								className="rounded-xl border border-l-4 border-l-muted p-5 space-y-3"
							>
								<Skeleton className="h-4 w-24" />
								<Skeleton className="h-5 w-48" />
								<Skeleton className="h-4 w-full" />
								<Skeleton className="h-4 w-3/4" />
								<Skeleton className="h-3 w-32 mt-1" />
							</div>
						))}
					</div>
				)}

				{/* Error */}
				{isError && (
					<div className="py-16 text-center">
						<div className="size-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
							<AlertCircle className="size-6 text-destructive" />
						</div>
						<h2 className="font-medium text-lg mb-1">
							Failed to load knowledge items
						</h2>
						<p className="text-sm text-muted-foreground max-w-sm mx-auto mb-4">
							{items.error}
						</p>
						<Button variant="outline" size="sm" onClick={() => fetchItems()}>
							Retry
						</Button>
					</div>
				)}

				{/* Empty knowledge base */}
				{isEmptyKnowledgeBase && (
					<div className="py-16 text-center">
						<div className="size-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
							<BookOpen className="size-6 text-muted-foreground" />
						</div>
						<h2 className="font-medium text-lg mb-1">No knowledge items yet</h2>
						<p className="text-sm text-muted-foreground max-w-sm mx-auto">
							Knowledge items are extracted as workflows run. Patterns, gotchas,
							and process improvements will appear here automatically.
						</p>
					</div>
				)}

				{/* Content with data */}
				{hasData && !isEmptyKnowledgeBase && (
					<>
						{/* Errors */}
						{items.error && (
							<p className="text-destructive text-sm">{items.error}</p>
						)}
						{searchResults.error && (
							<p className="text-destructive text-sm">{searchResults.error}</p>
						)}

						{/* Search results */}
						{isSearchActive ? (
							searchResults.loading ? (
								<div className="py-12 text-center">
									<div className="size-8 rounded-full border-2 border-muted border-t-foreground animate-spin mx-auto mb-3" />
									<p className="text-sm text-muted-foreground">Searching...</p>
								</div>
							) : searchResults.data?.results.length === 0 ? (
								<div className="py-12 text-center">
									<div className="size-10 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
										<Search className="size-5 text-muted-foreground" />
									</div>
									<h3 className="font-medium mb-1">No results found</h3>
									<p className="text-sm text-muted-foreground">
										No items match &ldquo;{searchQuery}
										&rdquo;. Try a different search term.
									</p>
								</div>
							) : (
								<div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
									{searchResults.data?.results.map((item) => (
										<KnowledgeItemCard key={item.id} item={item} />
									))}
								</div>
							)
						) : view === "timeline" ? (
							<KnowledgeTimeline />
						) : items.data?.items.length === 0 ? (
							<div className="py-12 text-center">
								<div className="size-10 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
									<Search className="size-5 text-muted-foreground" />
								</div>
								<h3 className="font-medium mb-1">No matching items</h3>
								<p className="text-sm text-muted-foreground">
									No items match the current filters.{" "}
									<button
										type="button"
										className="text-foreground underline underline-offset-2 hover:no-underline"
										onClick={handleClearAll}
									>
										Clear all filters
									</button>
								</p>
							</div>
						) : (
							<>
								<div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
									{items.data?.items.map((item) => (
										<KnowledgeItemCard key={item.id} item={item} />
									))}
								</div>

								{/* Pagination */}
								{totalPages > 1 && (
									<div className="flex items-center justify-center gap-3 pt-2">
										<Button
											variant="ghost"
											size="sm"
											disabled={!hasPreviousPage}
											onClick={() => goToPage(currentPage - 1)}
										>
											<ChevronLeft className="size-4 mr-1" />
											Previous
										</Button>
										<span className="text-sm text-muted-foreground tabular-nums">
											{currentPage} / {totalPages}
										</span>
										<Button
											variant="ghost"
											size="sm"
											disabled={!hasNextPage}
											onClick={() => goToPage(currentPage + 1)}
										>
											Next
											<ChevronRight className="size-4 ml-1" />
										</Button>
									</div>
								)}
							</>
						)}
					</>
				)}
			</div>
		</div>
	);
}
