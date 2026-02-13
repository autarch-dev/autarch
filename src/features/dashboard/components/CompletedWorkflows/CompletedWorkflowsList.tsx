/**
 * CompletedWorkflowsList - Presenter component for the completed workflows page
 *
 * Renders enriched completed workflows grouped by date buckets (Today, Yesterday,
 * This Week, etc.). Each workflow is displayed as a card with metadata including
 * duration, cost, review summary, diff stats, and linked initiative.
 */

import { ArrowLeft, CheckCircle2, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { groupByDateBucket } from "../../utils/dateBuckets";
import type { EnrichedWorkflow } from "./CompletedWorkflowsPage";

export interface CompletedWorkflowsListProps {
	enrichedWorkflows: EnrichedWorkflow[];
	isLoading: boolean;
}

/** Format a duration in milliseconds as a human-readable string (e.g., '2h 35m' or '3d 4h') */
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

export function CompletedWorkflowsList({
	enrichedWorkflows,
	isLoading,
}: CompletedWorkflowsListProps) {
	const [, setLocation] = useLocation();
	const [searchText, setSearchText] = useState("");

	const filteredWorkflows = useMemo(() => {
		const query = searchText.trim().toLowerCase();
		if (!query) return enrichedWorkflows;
		return enrichedWorkflows.filter((ew) => {
			const title = ew.workflow.title.toLowerCase();
			const description = ew.workflow.description?.toLowerCase() ?? "";
			return title.includes(query) || description.includes(query);
		});
	}, [searchText, enrichedWorkflows]);

	const buckets = groupByDateBucket<EnrichedWorkflow>(
		filteredWorkflows,
		(ew) => ew.workflow.updatedAt,
	);

	const totalCostDisplay = useMemo(() => {
		const costs = enrichedWorkflows
			.map((ew) => ew.totalCost)
			.filter((c): c is number => c != null);
		return costs.length > 0
			? `$${costs.reduce((sum, c) => sum + c, 0).toFixed(2)}`
			: "\u2014";
	}, [enrichedWorkflows]);

	const totalLinesChangedDisplay = useMemo(() => {
		const diffs = enrichedWorkflows
			.map((ew) => ew.diffStats)
			.filter((d): d is NonNullable<typeof d> => d != null);
		return diffs.length > 0
			? diffs
					.reduce((sum, d) => sum + d.additions + d.deletions, 0)
					.toLocaleString()
			: "\u2014";
	}, [enrichedWorkflows]);

	const avgDurationDisplay = useMemo(() => {
		if (enrichedWorkflows.length === 0) return "\u2014";
		const totalMs = enrichedWorkflows.reduce((sum, ew) => sum + ew.duration, 0);
		return formatDuration(totalMs / enrichedWorkflows.length);
	}, [enrichedWorkflows]);

	return (
		<div className="flex flex-col h-full overflow-y-auto">
			{/* Page header */}
			<header className="px-6 py-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
				<div className="flex items-center gap-3">
					<Link
						href="/dashboard"
						className="text-muted-foreground hover:text-foreground transition-colors"
					>
						<ArrowLeft className="size-4" />
					</Link>
					<h1 className="text-lg font-semibold">Completed Workflows</h1>
					<div className="relative flex-1 min-w-[200px] max-w-[300px] ml-auto">
						<Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
						<Input
							placeholder="Search workflows..."
							value={searchText}
							onChange={(e) => setSearchText(e.target.value)}
							className="h-8 pl-8 text-sm"
						/>
					</div>
				</div>
			</header>

			{/* Summary stats bar — only when loaded with data */}
			{!isLoading && enrichedWorkflows.length > 0 && (
				<div className="px-6 pt-4 pb-0">
					<Card>
						<CardContent className="py-4">
							<div className="grid grid-cols-4 gap-4 text-center text-sm">
								<div>
									<div className="text-2xl font-semibold">
										{enrichedWorkflows.length}
									</div>
									<div className="text-muted-foreground">Completed</div>
								</div>
								<div>
									<div className="text-2xl font-semibold">
										{totalCostDisplay}
									</div>
									<div className="text-muted-foreground">Total Cost</div>
								</div>
								<div>
									<div className="text-2xl font-semibold">
										{avgDurationDisplay}
									</div>
									<div className="text-muted-foreground">Avg Duration</div>
								</div>
								<div>
									<div className="text-2xl font-semibold">
										{totalLinesChangedDisplay}
									</div>
									<div className="text-muted-foreground">Lines Changed</div>
								</div>
							</div>
						</CardContent>
					</Card>
				</div>
			)}

			{/* Content */}
			<div className="flex-1 p-6 space-y-8">
				{/* Loading skeletons */}
				{isLoading && enrichedWorkflows.length === 0 && (
					<div className="space-y-4">
						{["skeleton-1", "skeleton-2", "skeleton-3"].map((key) => (
							<Card key={key}>
								<CardHeader>
									<Skeleton className="h-5 w-48" />
									<Skeleton className="h-4 w-72" />
								</CardHeader>
								<CardContent>
									<Skeleton className="h-4 w-64" />
								</CardContent>
							</Card>
						))}
					</div>
				)}

				{/* Empty state */}
				{!isLoading && enrichedWorkflows.length === 0 && (
					<div className="px-4 py-8 text-center">
						<div className="size-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
							<CheckCircle2 className="size-6 text-muted-foreground" />
						</div>
						<h4 className="font-medium mb-1">No completed workflows yet</h4>
						<p className="text-sm text-muted-foreground max-w-sm mx-auto">
							Workflows will appear here once they finish running. Completed
							workflows include cost, duration, and diff stats.
						</p>
						<div className="mt-4 flex items-center justify-center gap-2">
							<Button asChild>
								<Link href="/">Go to Dashboard</Link>
							</Button>
						</div>
					</div>
				)}

				{/* No search results */}
				{!isLoading &&
					enrichedWorkflows.length > 0 &&
					filteredWorkflows.length === 0 && (
						<div className="px-4 py-8 text-center">
							<div className="size-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
								<Search className="size-6 text-muted-foreground" />
							</div>
							<h4 className="font-medium mb-1">No matching workflows</h4>
							<p className="text-sm text-muted-foreground max-w-sm mx-auto">
								No completed workflows match your search. Try a different query
								or clear the search to see all {enrichedWorkflows.length}{" "}
								completed{" "}
								{enrichedWorkflows.length === 1 ? "workflow" : "workflows"}.
							</p>
							<div className="mt-4 flex items-center justify-center gap-2">
								<Button variant="outline" onClick={() => setSearchText("")}>
									Clear search
								</Button>
							</div>
						</div>
					)}

				{/* Date-bucketed workflow cards */}
				{buckets.map((bucket) => (
					<section key={bucket.label}>
						<h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-2">
							{bucket.label}
						</h2>
						<div className="space-y-3">
							{bucket.items.map((ew) => (
								<Link
									key={ew.workflow.id}
									href={`/workflow/${ew.workflow.id}`}
									className="block"
								>
									<Card
										className={cn(
											"transition-colors hover:border-foreground/20",
										)}
									>
										<CardHeader>
											<CardTitle className="text-base">
												{ew.workflow.title}
											</CardTitle>
											{ew.workflow.description && (
												<CardDescription className="line-clamp-2">
													{ew.workflow.description}
												</CardDescription>
											)}
										</CardHeader>
										<CardContent>
											<div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
												<div className="text-muted-foreground">
													<span className="font-medium text-foreground">
														{formatDuration(ew.duration)}
													</span>{" "}
													duration
												</div>
												<button
													type="button"
													className="cursor-pointer text-muted-foreground underline-offset-2 hover:underline"
													onClick={(e) => {
														e.stopPropagation();
														e.preventDefault();
														setLocation(`/costs?workflowId=${ew.workflow.id}`);
													}}
												>
													<span className="font-medium text-primary hover:text-primary/80">
														{ew.totalCost != null
															? `$${ew.totalCost.toFixed(2)}`
															: "—"}
													</span>{" "}
													cost
												</button>
												<div
													className={cn(
														"text-muted-foreground",
														!ew.diffStats && "hidden",
													)}
												>
													<span className="font-medium text-foreground">
														{ew.diffStats
															? `${ew.diffStats.fileCount} files, +${ew.diffStats.additions}/-${ew.diffStats.deletions} lines`
															: null}
													</span>
												</div>
												<div className="text-muted-foreground truncate">
													<span
														className={cn(
															"font-medium",
															ew.reviewSummary
																? "text-foreground"
																: "text-muted-foreground",
														)}
													>
														{ew.reviewSummary ? (
															<span className="line-clamp-1">
																{ew.reviewSummary}
															</span>
														) : (
															"No review"
														)}
													</span>
												</div>
											</div>
											{ew.initiativeTitle && (
												<div className="mt-3">
													<Badge variant="secondary">
														{ew.initiativeTitle}
													</Badge>
												</div>
											)}
										</CardContent>
									</Card>
								</Link>
							))}
						</div>
					</section>
				))}
			</div>
		</div>
	);
}
