/**
 * CompletedWorkflowsList - Presenter component for the completed workflows page
 *
 * Renders enriched completed workflows grouped by date buckets (Today, Yesterday,
 * This Week, etc.). Each workflow is displayed as a row in a card with metadata
 * including duration, cost, review summary, diff stats, and linked initiative.
 */

import { CheckCircle2, Clock, Code2, DollarSign, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { groupByDateBucket } from "../../utils/dateBuckets";
import type { EnrichedWorkflow } from "./CompletedWorkflowsPage";

export interface CompletedWorkflowsListProps {
	enrichedWorkflows: EnrichedWorkflow[];
	isLoading: boolean;
}

/** Format a duration in milliseconds as a human-readable string */
function formatDuration(ms: number): string {
	const totalMinutes = Math.floor(ms / 60_000);
	const minutes = totalMinutes % 60;
	const totalHours = Math.floor(totalMinutes / 60);
	const hours = totalHours % 24;
	const days = Math.floor(totalHours / 24);

	if (days > 0) {
		return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
	}
	if (hours > 0) {
		return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
	}
	return `${minutes}m`;
}

// ---------------------------------------------------------------------------
// Stat Card
// ---------------------------------------------------------------------------

function StatCard({
	label,
	value,
	icon: Icon,
}: {
	label: string;
	value: string;
	icon: React.ComponentType<{ className?: string }>;
}) {
	return (
		<div className="rounded-xl border bg-card text-card-foreground shadow-sm p-4">
			<div className="flex items-center justify-between">
				<div>
					<p className="text-2xl font-semibold tabular-nums tracking-tight">
						{value}
					</p>
					<p className="text-xs text-muted-foreground mt-0.5">{label}</p>
				</div>
				<div className="size-9 rounded-lg bg-muted flex items-center justify-center">
					<Icon className="size-4 text-muted-foreground" />
				</div>
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function CompletedWorkflowsList({
	enrichedWorkflows,
	isLoading,
}: CompletedWorkflowsListProps) {
	const [, setLocation] = useLocation();
	const [searchText, setSearchText] = useState("");

	// Filter workflows by search text
	const filteredWorkflows = useMemo(() => {
		const query = searchText.trim().toLowerCase();
		if (!query) return enrichedWorkflows;
		return enrichedWorkflows.filter((ew) => {
			const title = ew.workflow.title.toLowerCase();
			const description = ew.workflow.description?.toLowerCase() ?? "";
			return title.includes(query) || description.includes(query);
		});
	}, [searchText, enrichedWorkflows]);

	// Group into date buckets
	const buckets = groupByDateBucket<EnrichedWorkflow>(
		filteredWorkflows,
		(ew) => ew.workflow.updatedAt,
	);

	// Aggregate stats
	const stats = useMemo(() => {
		const costs = enrichedWorkflows
			.map((ew) => ew.totalCost)
			.filter((c): c is number => c != null);
		const totalCost =
			costs.length > 0
				? `$${costs.reduce((sum, c) => sum + c, 0).toFixed(2)}`
				: "\u2014";

		const diffs = enrichedWorkflows
			.map((ew) => ew.diffStats)
			.filter((d): d is NonNullable<typeof d> => d != null);
		const totalLines =
			diffs.length > 0
				? diffs
						.reduce((sum, d) => sum + d.additions + d.deletions, 0)
						.toLocaleString()
				: "\u2014";

		const avgDuration =
			enrichedWorkflows.length > 0
				? formatDuration(
						enrichedWorkflows.reduce((sum, ew) => sum + ew.duration, 0) /
							enrichedWorkflows.length,
					)
				: "\u2014";

		return {
			count: enrichedWorkflows.length.toString(),
			totalCost,
			totalLines,
			avgDuration,
		};
	}, [enrichedWorkflows]);

	return (
		<div className="flex-1 overflow-auto">
			<div className="mx-auto max-w-5xl px-8 py-10 space-y-10">
				{/* Page title + search */}
				<div className="flex items-center justify-between gap-4">
					<div>
						<h1 className="text-2xl font-semibold tracking-tight">
							Completed Workflows
						</h1>
						<p className="text-sm text-muted-foreground mt-1">
							{enrichedWorkflows.length}{" "}
							{enrichedWorkflows.length === 1 ? "workflow" : "workflows"}{" "}
							completed
						</p>
					</div>
					<div className="relative w-64 shrink-0">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
						<input
							type="text"
							placeholder="Filter workflows..."
							value={searchText}
							onChange={(e) => setSearchText(e.target.value)}
							className="flex h-9 w-full rounded-md border bg-transparent px-3 pl-9 py-1 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
						/>
					</div>
				</div>

				{/* Loading skeletons */}
				{isLoading && enrichedWorkflows.length === 0 && (
					<div className="space-y-6">
						<div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
							{[1, 2, 3, 4].map((i) => (
								<div key={i} className="rounded-xl border bg-card p-4">
									<Skeleton className="h-7 w-12 mb-1.5" />
									<Skeleton className="h-3 w-20" />
								</div>
							))}
						</div>
						<div>
							<Skeleton className="h-4 w-24 mb-3" />
							<Card className="py-0 gap-0 overflow-hidden">
								{[1, 2, 3].map((i) => (
									<div key={i} className={cn("px-4 py-4", i > 1 && "border-t")}>
										<Skeleton className="h-4 w-48 mb-2" />
										<Skeleton className="h-3 w-72 mb-2" />
										<Skeleton className="h-3 w-36" />
									</div>
								))}
							</Card>
						</div>
					</div>
				)}

				{/* Empty state */}
				{!isLoading && enrichedWorkflows.length === 0 && (
					<div className="py-16 text-center">
						<div className="size-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
							<CheckCircle2 className="size-6 text-muted-foreground" />
						</div>
						<h2 className="font-medium text-lg mb-1">
							No completed workflows yet
						</h2>
						<p className="text-sm text-muted-foreground max-w-sm mx-auto">
							Workflows will appear here once they finish running. Completed
							workflows include cost, duration, and diff stats.
						</p>
					</div>
				)}

				{/* Stats + content */}
				{!isLoading && enrichedWorkflows.length > 0 && (
					<>
						{/* Stats grid */}
						<div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
							<StatCard
								label="Completed"
								value={stats.count}
								icon={CheckCircle2}
							/>
							<StatCard
								label="Total Cost"
								value={stats.totalCost}
								icon={DollarSign}
							/>
							<StatCard
								label="Avg Duration"
								value={stats.avgDuration}
								icon={Clock}
							/>
							<StatCard
								label="Lines Changed"
								value={stats.totalLines}
								icon={Code2}
							/>
						</div>

						{/* No search results */}
						{filteredWorkflows.length === 0 && (
							<div className="py-12 text-center">
								<div className="size-10 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
									<Search className="size-5 text-muted-foreground" />
								</div>
								<h3 className="font-medium mb-1">No matching workflows</h3>
								<p className="text-sm text-muted-foreground">
									Try a different search term or{" "}
									<button
										type="button"
										className="text-foreground underline underline-offset-2 hover:no-underline"
										onClick={() => setSearchText("")}
									>
										clear the filter
									</button>
								</p>
							</div>
						)}

						{/* Date-bucketed workflow cards */}
						{buckets.map((bucket) => (
							<section key={bucket.label}>
								<h2 className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-3">
									{bucket.label}
								</h2>
								<Card className="py-0 gap-0 overflow-hidden">
									{bucket.items.map((ew, i) => (
										<Link
											key={ew.workflow.id}
											href={`/workflow/${ew.workflow.id}`}
										>
											<div
												className={cn(
													"flex items-start gap-3 px-4 py-3.5 hover:bg-accent/50 transition-colors cursor-pointer",
													i > 0 && "border-t",
												)}
											>
												{/* Status icon */}
												<CheckCircle2 className="size-4 shrink-0 text-green-500 mt-0.5" />

												{/* Content */}
												<div className="flex-1 min-w-0">
													{/* Title row */}
													<div className="flex items-baseline justify-between gap-3">
														<span className="font-medium text-sm truncate">
															{ew.workflow.title}
														</span>
														<span className="text-xs text-muted-foreground tabular-nums shrink-0">
															{formatDuration(ew.duration)}
														</span>
													</div>

													{/* Description or review summary */}
													{(ew.reviewSummary || ew.workflow.description) && (
														<p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
															{ew.reviewSummary ?? ew.workflow.description}
														</p>
													)}

													{/* Metadata row */}
													<div className="flex items-center gap-3 mt-2 flex-wrap">
														{ew.totalCost != null && (
															<button
																type="button"
																className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
																onClick={(e) => {
																	e.stopPropagation();
																	e.preventDefault();
																	setLocation(
																		`/costs?workflowId=${ew.workflow.id}`,
																	);
																}}
															>
																<DollarSign className="size-3" />
																<span className="tabular-nums">
																	{ew.totalCost.toFixed(2)}
																</span>
															</button>
														)}

														{ew.diffStats && (
															<span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
																<Code2 className="size-3" />
																<span>
																	{ew.diffStats.fileCount}{" "}
																	{ew.diffStats.fileCount === 1
																		? "file"
																		: "files"}
																</span>
																<span className="text-green-600 dark:text-green-400 tabular-nums">
																	+{ew.diffStats.additions}
																</span>
																<span className="text-red-600 dark:text-red-400 tabular-nums">
																	-{ew.diffStats.deletions}
																</span>
															</span>
														)}

														{ew.initiativeTitle && (
															<Badge
																variant="secondary"
																className="text-xs py-0"
															>
																{ew.initiativeTitle}
															</Badge>
														)}
													</div>
												</div>
											</div>
										</Link>
									))}
								</Card>
							</section>
						))}
					</>
				)}
			</div>
		</div>
	);
}
