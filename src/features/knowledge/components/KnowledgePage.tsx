/**
 * KnowledgePage - Main knowledge management page
 *
 * Reads URL query params on mount to initialize filters, then fetches
 * knowledge items. Composes FilterBar, item cards, and timeline into a
 * tabbed layout. Displays search results when a search query is active.
 */

import { AlertCircle, BookOpen, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect } from "react";
import { useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useKnowledgeStore } from "../store/knowledgeStore";
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

	return filters;
}

const DEFAULT_PAGE_SIZE = 20;

// =============================================================================
// Component
// =============================================================================

export function KnowledgePage() {
	const setFilters = useKnowledgeStore((s) => s.setFilters);
	const fetchItems = useKnowledgeStore((s) => s.fetchItems);
	const items = useKnowledgeStore((s) => s.items);
	const searchQuery = useKnowledgeStore((s) => s.searchQuery);
	const searchResults = useKnowledgeStore((s) => s.searchResults);
	const filters = useKnowledgeStore((s) => s.filters);
	const search = useSearch();

	const isLoading = items.loading && items.data === null;
	const isError = !items.loading && items.data === null && items.error !== null;
	const hasData = items.data !== null;

	// "No items exist at all" — distinguished from "no results matching filters"
	const hasActiveFilters =
		filters.category != null ||
		filters.workflowId != null ||
		filters.startDate != null ||
		filters.endDate != null ||
		filters.archived != null;
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

	// Errors
	const itemsError = items.error;
	const searchError = searchResults.error;

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

	function goToPage(page: number) {
		const newOffset = (page - 1) * pageSize;
		setFilters({ offset: newOffset });
		fetchItems();
	}

	return (
		<div className="flex flex-col gap-6 p-6 overflow-auto h-full">
			<h1 className="text-2xl font-bold tracking-tight">Knowledge Base</h1>

			<Tabs defaultValue="browse">
				<TabsList>
					<TabsTrigger value="browse">Browse</TabsTrigger>
					<TabsTrigger value="timeline">Timeline</TabsTrigger>
				</TabsList>

				<TabsContent value="browse">
					{isLoading ? (
						<p className="text-muted-foreground text-center py-8">
							Loading knowledge items...
						</p>
					) : isError ? (
						<div className="px-4 py-8 text-center">
							<div className="size-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
								<AlertCircle className="size-6 text-destructive" />
							</div>
							<h4 className="font-medium mb-1">
								Failed to load knowledge items
							</h4>
							<p className="text-sm text-muted-foreground max-w-sm mx-auto mb-4">
								{items.error}
							</p>
							<Button variant="outline" size="sm" onClick={() => fetchItems()}>
								Retry
							</Button>
						</div>
					) : isEmptyKnowledgeBase ? (
						<div className="px-4 py-8 text-center">
							<div className="size-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
								<BookOpen className="size-6 text-muted-foreground" />
							</div>
							<h4 className="font-medium mb-1">No knowledge items yet</h4>
							<p className="text-sm text-muted-foreground max-w-sm mx-auto">
								Knowledge items are extracted as workflows run. Patterns,
								gotchas, and process improvements will appear here
								automatically.
							</p>
						</div>
					) : hasData ? (
						<>
							<KnowledgeFilterBar />

							{itemsError && (
								<p className="text-destructive text-sm">{itemsError}</p>
							)}
							{searchError && (
								<p className="text-destructive text-sm">{searchError}</p>
							)}

							{isSearchActive ? (
								// Search results mode
								searchResults.loading ? (
									<p className="text-muted-foreground text-center py-8">
										Searching...
									</p>
								) : searchResults.data?.results.length === 0 ? (
									<p className="text-muted-foreground text-center py-8">
										No results found for &ldquo;{searchQuery}&rdquo;
									</p>
								) : (
									<div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
										{searchResults.data?.results.map((item) => (
											<KnowledgeItemCard key={item.id} item={item} />
										))}
									</div>
								)
							) : // Browse mode
							items.data?.items.length === 0 ? (
								<p className="text-muted-foreground text-center py-8">
									No items match the current filters
								</p>
							) : (
								<>
									<div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
										{items.data?.items.map((item) => (
											<KnowledgeItemCard key={item.id} item={item} />
										))}
									</div>

									{totalPages > 1 && (
										<div className="flex items-center justify-center gap-2 pt-4">
											<Button
												variant="outline"
												size="sm"
												disabled={!hasPreviousPage}
												onClick={() => goToPage(currentPage - 1)}
											>
												<ChevronLeft className="size-4" />
												Previous
											</Button>
											<span className="text-sm text-muted-foreground px-2">
												Page {currentPage} of {totalPages}
											</span>
											<Button
												variant="outline"
												size="sm"
												disabled={!hasNextPage}
												onClick={() => goToPage(currentPage + 1)}
											>
												Next
												<ChevronRight className="size-4" />
											</Button>
										</div>
									)}
								</>
							)}
						</>
					) : null}
				</TabsContent>

				<TabsContent value="timeline">
					<KnowledgeTimeline />
				</TabsContent>
			</Tabs>
		</div>
	);
}
