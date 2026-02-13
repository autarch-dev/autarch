/**
 * KnowledgePage - Main knowledge management page
 *
 * Reads URL query params on mount to initialize filters, then fetches
 * knowledge items. Composes FilterBar, item cards, edit dialog, and
 * timeline into a tabbed layout.
 */

import { BookOpen } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearch } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { KnowledgeItem } from "@/shared/schemas/knowledge";
import { useKnowledgeStore } from "../store/knowledgeStore";
import { KnowledgeEditDialog } from "./KnowledgeEditDialog";
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

// =============================================================================
// Component
// =============================================================================

export function KnowledgePage() {
	const setFilters = useKnowledgeStore((s) => s.setFilters);
	const fetchItems = useKnowledgeStore((s) => s.fetchItems);
	const items = useKnowledgeStore((s) => s.items);
	const search = useSearch();

	// Edit dialog state managed at page level
	const [selectedItemForEdit, _setSelectedItemForEdit] =
		useState<KnowledgeItem | null>(null);
	const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

	const isLoading = items.loading && items.data === null;
	const isEmpty =
		!items.loading && items.data !== null && items.data.items.length === 0;

	useEffect(() => {
		const filters = parseFiltersFromSearch(search);
		setFilters({
			category: undefined,
			workflowId: undefined,
			startDate: undefined,
			endDate: undefined,
			archived: undefined,
			...filters,
		});
		fetchItems();
	}, [search, setFilters, fetchItems]);

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
					) : isEmpty ? (
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
					) : (
						<>
							<KnowledgeFilterBar />
							<div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
								{items.data?.items.map((item) => (
									<KnowledgeItemCard key={item.id} item={item} />
								))}
							</div>
						</>
					)}
				</TabsContent>

				<TabsContent value="timeline">
					<KnowledgeTimeline />
				</TabsContent>
			</Tabs>

			<KnowledgeEditDialog
				item={selectedItemForEdit}
				open={isEditDialogOpen}
				onOpenChange={setIsEditDialogOpen}
			/>
		</div>
	);
}
