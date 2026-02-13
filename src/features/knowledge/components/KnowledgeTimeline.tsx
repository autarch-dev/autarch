/**
 * KnowledgeTimeline
 *
 * Visual timeline view that groups knowledge items by workflowId with a
 * vertical line connecting workflow groups. Each item is marked with a
 * colored dot based on its category.
 *
 * NOTE: This view displays the same paginated slice of data shown in the
 * browse view. Use the browse view's pagination controls to load different
 * pages.
 */

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { KnowledgeItem } from "@/shared/schemas/knowledge";
import { useKnowledgeStore } from "../store/knowledgeStore";
import { CATEGORY_CONFIG, timeAgo } from "../utils/format";

// =============================================================================
// Sub-component for expandable timeline items
// =============================================================================

function TimelineItemContent({ item }: { item: KnowledgeItem }) {
	const [expanded, setExpanded] = useState(false);
	const cfg = CATEGORY_CONFIG[item.category];
	const isLongContent = item.content.length > 150;

	return (
		<div className="rounded-lg border bg-card p-3.5 transition-colors hover:border-foreground/10">
			{/* Header row */}
			<div className="flex items-center gap-2 mb-1.5">
				<span
					className={cn(
						"inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
						cfg.pill,
					)}
				>
					{cfg.label}
				</span>
				<span className="text-xs text-muted-foreground">
					{timeAgo(item.createdAt)}
				</span>
			</div>

			{/* Title */}
			<h4 className="text-sm font-medium leading-snug">{item.title}</h4>

			{/* Content — expandable */}
			<div>
				<p
					className={cn(
						"text-xs text-muted-foreground mt-1 leading-relaxed",
						expanded ? "whitespace-pre-wrap" : "line-clamp-2",
					)}
				>
					{item.content}
				</p>
				{isLongContent && (
					<button
						type="button"
						onClick={() => setExpanded(!expanded)}
						className="text-xs text-muted-foreground/70 hover:text-foreground mt-1 transition-colors"
					>
						{expanded ? "Show less" : "Show more"}
					</button>
				)}
			</div>

			{/* Tags */}
			{item.tags.length > 0 && (
				<div className="flex items-center gap-1.5 mt-2 flex-wrap">
					{item.tags.map((tag) => (
						<span
							key={tag}
							className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
						>
							{tag}
						</span>
					))}
				</div>
			)}
		</div>
	);
}

// =============================================================================
// Helpers
// =============================================================================

/** Group items by workflowId, sorted by earliest createdAt (most recent first) */
function groupByWorkflow(
	items: KnowledgeItem[],
): { workflowId: string; items: KnowledgeItem[] }[] {
	const grouped = new Map<string, KnowledgeItem[]>();

	for (const item of items) {
		const existing = grouped.get(item.workflowId);
		if (existing) {
			existing.push(item);
		} else {
			grouped.set(item.workflowId, [item]);
		}
	}

	// Sort items within each group by createdAt descending
	for (const group of grouped.values()) {
		group.sort((a, b) => b.createdAt - a.createdAt);
	}

	// Convert to array and sort groups by earliest createdAt (most recent first)
	return Array.from(grouped.entries())
		.map(([workflowId, groupItems]) => ({
			workflowId,
			items: groupItems,
		}))
		.sort((a, b) => {
			const aEarliest = Math.min(...a.items.map((i) => i.createdAt));
			const bEarliest = Math.min(...b.items.map((i) => i.createdAt));
			return bEarliest - aEarliest;
		});
}

// =============================================================================
// Component
// =============================================================================

export function KnowledgeTimeline() {
	const { items } = useKnowledgeStore();
	const allItems = items.data?.items ?? [];

	const groups = useMemo(() => groupByWorkflow(allItems), [allItems]);

	if (!allItems.length) {
		return (
			<div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
				No knowledge items to display.
			</div>
		);
	}

	const total = items.data?.total ?? 0;
	const showingPartial = total > allItems.length;

	return (
		<div className="space-y-2">
			{showingPartial && (
				<p className="text-xs text-muted-foreground text-center mb-6">
					Showing {allItems.length} of {total} items. Use pagination in Browse
					view to load more.
				</p>
			)}

			{/* Timeline container */}
			<div className="relative ml-3">
				{/* Vertical line */}
				<div className="absolute left-[9px] top-3 bottom-3 w-px bg-border" />

				{groups.map((group, groupIndex) => {
					const lastItem = group.items[group.items.length - 1];
					const groupDate = lastItem
						? new Date(lastItem.createdAt)
						: new Date();

					return (
						<div
							key={group.workflowId}
							className={cn(groupIndex > 0 && "mt-10")}
						>
							{/* Workflow group header */}
							<div className="relative flex items-center gap-3 pb-4">
								{/* Large circle marker */}
								<div className="relative z-10 flex size-5 items-center justify-center rounded-full border-2 border-border bg-background">
									<div className="size-2 rounded-full bg-foreground" />
								</div>

								<div className="min-w-0">
									<h3
										className="text-sm font-medium truncate"
										title={group.workflowId}
									>
										{group.workflowId}
									</h3>
									<p className="text-xs text-muted-foreground">
										{groupDate.toLocaleDateString(undefined, {
											month: "short",
											day: "numeric",
											year: "numeric",
										})}{" "}
										· {group.items.length}{" "}
										{group.items.length === 1 ? "item" : "items"}
									</p>
								</div>
							</div>

							{/* Items in this workflow */}
							<div className="space-y-0">
								{group.items.map((item, itemIndex) => {
									const cfg = CATEGORY_CONFIG[item.category];
									const isLast = itemIndex === group.items.length - 1;

									return (
										<div
											key={item.id}
											className={cn("relative pl-10", !isLast && "pb-5")}
										>
											{/* Colored dot */}
											<div
												className={cn(
													"absolute left-[5px] top-1.5 z-10 size-[10px] rounded-full ring-2 ring-background",
													cfg.dot,
												)}
											/>

											<TimelineItemContent item={item} />
										</div>
									);
								})}
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}
