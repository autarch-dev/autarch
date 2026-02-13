/**
 * KnowledgeTimeline
 *
 * Read-only timeline view that groups knowledge items by workflowId and
 * sorts them chronologically. Designed for quick scanning — no edit/delete
 * actions are exposed.
 */

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { KnowledgeItem } from "@/shared/schemas/knowledge";
import { useKnowledgeStore } from "../store/knowledgeStore";
import { categoryVariant, truncate } from "../utils/format";

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

	return (
		<div className="space-y-6">
			{groups.map((group, groupIndex) => (
				<div key={group.workflowId}>
					{groupIndex > 0 && <Separator className="mb-6" />}

					{/* Workflow section header */}
					<h3 className="mb-3 border-l-4 border-primary pl-3 text-lg font-semibold">
						{group.workflowId}
					</h3>

					{/* Items in this workflow */}
					<div className="space-y-2">
						{group.items.map((item) => (
							<Card key={item.id}>
								<CardHeader className="pb-2">
									<div className="flex items-center justify-between gap-2">
										<CardTitle className="text-sm">{item.title}</CardTitle>
										<Badge
											variant={categoryVariant(item.category)}
											className="shrink-0 text-xs"
										>
											{item.category}
										</Badge>
									</div>
								</CardHeader>
								<CardContent className="pt-0">
									<p className="text-sm text-muted-foreground">
										{truncate(item.content)}
									</p>
									<div className="mt-1 text-xs text-muted-foreground">
										{new Date(item.createdAt).toLocaleString()}
									</div>
								</CardContent>
							</Card>
						))}
					</div>
				</div>
			))}
		</div>
	);
}
