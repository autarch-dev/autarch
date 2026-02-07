/**
 * TimelineView - Size-proportional overview visualization of roadmap milestones and initiatives
 *
 * Renders a horizontal bar chart where milestone bar widths are proportional to their
 * total initiative sizes. Milestones without any sized initiatives are shown in an
 * "Unsized" section at the bottom.
 */

import { BarChart3, ChevronDown, ChevronRight } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type {
	Initiative,
	Milestone,
	RoadmapDependency,
} from "@/shared/schemas/roadmap";

// =============================================================================
// Types
// =============================================================================

interface TimelineViewProps {
	roadmapId: string;
	milestones: Milestone[];
	initiatives: Initiative[];
	dependencies: RoadmapDependency[];
	onSelectInitiative?: (initiative: Initiative) => void;
}

// =============================================================================
// Constants
// =============================================================================

const MILESTONE_COLORS = [
	"bg-blue-500 dark:bg-blue-600",
	"bg-violet-500 dark:bg-violet-600",
	"bg-emerald-500 dark:bg-emerald-600",
	"bg-amber-500 dark:bg-amber-600",
	"bg-rose-500 dark:bg-rose-600",
	"bg-cyan-500 dark:bg-cyan-600",
	"bg-pink-500 dark:bg-pink-600",
	"bg-teal-500 dark:bg-teal-600",
];

const INITIATIVE_COLORS = [
	"bg-blue-400/70 dark:bg-blue-500/50",
	"bg-violet-400/70 dark:bg-violet-500/50",
	"bg-emerald-400/70 dark:bg-emerald-500/50",
	"bg-amber-400/70 dark:bg-amber-500/50",
	"bg-rose-400/70 dark:bg-rose-500/50",
	"bg-cyan-400/70 dark:bg-cyan-500/50",
	"bg-pink-400/70 dark:bg-pink-500/50",
	"bg-teal-400/70 dark:bg-teal-500/50",
];

const ROW_HEIGHT = 40;
const INITIATIVE_ROW_HEIGHT = 32;
const HEADER_HEIGHT = 48;
const LABEL_WIDTH = 200;

// =============================================================================
// Helpers
// =============================================================================

function getMilestoneColorIndex(milestoneIndex: number): number {
	return milestoneIndex % MILESTONE_COLORS.length;
}

function getMilestoneSize(initiatives: Initiative[]): number {
	return initiatives.reduce((sum, i) => sum + (i.size ?? 0), 0);
}

// =============================================================================
// Component: TimelineView
// =============================================================================

export function TimelineView({
	roadmapId: _roadmapId,
	milestones,
	initiatives,
	dependencies: _dependencies,
	onSelectInitiative,
}: TimelineViewProps) {
	const [collapsedMilestones, setCollapsedMilestones] = useState<Set<string>>(
		new Set(),
	);

	// -------------------------------------------------------------------------
	// Group initiatives by milestone
	// -------------------------------------------------------------------------
	const initiativesByMilestone = useMemo(() => {
		const grouped = new Map<string, Initiative[]>();
		for (const m of milestones) {
			grouped.set(m.id, []);
		}
		for (const initiative of initiatives) {
			const list = grouped.get(initiative.milestoneId);
			if (list) {
				list.push(initiative);
			}
		}
		// Sort each group by sortOrder
		for (const [, list] of grouped) {
			list.sort((a, b) => a.sortOrder - b.sortOrder);
		}
		return grouped;
	}, [milestones, initiatives]);

	// -------------------------------------------------------------------------
	// Partition milestones into sized and unsized
	// -------------------------------------------------------------------------
	const { sizedMilestones, unsizedMilestones, maxMilestoneSize } =
		useMemo(() => {
			const sized: Milestone[] = [];
			const unsized: Milestone[] = [];

			const sorted = [...milestones].sort((a, b) => a.sortOrder - b.sortOrder);
			for (const m of sorted) {
				const milestoneInitiatives = initiativesByMilestone.get(m.id) ?? [];
				const hasSizedInitiative = milestoneInitiatives.some(
					(i) => i.size != null,
				);
				if (hasSizedInitiative) {
					sized.push(m);
				} else {
					unsized.push(m);
				}
			}

			let maxSize = 0;
			for (const m of sized) {
				const total = getMilestoneSize(initiativesByMilestone.get(m.id) ?? []);
				if (total > maxSize) maxSize = total;
			}

			return {
				sizedMilestones: sized,
				unsizedMilestones: unsized,
				maxMilestoneSize: maxSize,
			};
		}, [milestones, initiativesByMilestone]);

	// -------------------------------------------------------------------------
	// Toggle milestone collapse
	// -------------------------------------------------------------------------
	const toggleMilestone = useCallback((milestoneId: string) => {
		setCollapsedMilestones((prev) => {
			const next = new Set(prev);
			if (next.has(milestoneId)) {
				next.delete(milestoneId);
			} else {
				next.add(milestoneId);
			}
			return next;
		});
	}, []);

	// -------------------------------------------------------------------------
	// Empty state
	// -------------------------------------------------------------------------
	if (milestones.length === 0) {
		return (
			<div className="flex items-center justify-center h-full rounded-lg border border-dashed">
				<div className="text-center space-y-2">
					<BarChart3 className="size-8 mx-auto text-muted-foreground" />
					<p className="text-muted-foreground">No milestones yet</p>
					<p className="text-sm text-muted-foreground">
						Create milestones and add sized initiatives to see the overview.
					</p>
				</div>
			</div>
		);
	}

	// -------------------------------------------------------------------------
	// Build row layout for sized milestones
	// -------------------------------------------------------------------------
	const sizedRows: Array<{
		type: "milestone" | "initiative";
		item: Milestone | Initiative;
		milestoneIndex: number;
	}> = [];

	for (let mi = 0; mi < sizedMilestones.length; mi++) {
		const milestone = sizedMilestones[mi];
		if (!milestone) continue;
		sizedRows.push({
			type: "milestone",
			item: milestone,
			milestoneIndex: mi,
		});

		if (!collapsedMilestones.has(milestone.id)) {
			const milestoneInitiatives =
				initiativesByMilestone.get(milestone.id) ?? [];
			for (const initiative of milestoneInitiatives) {
				sizedRows.push({
					type: "initiative",
					item: initiative,
					milestoneIndex: mi,
				});
			}
		}
	}

	return (
		<div className="flex flex-col gap-3 h-full">
			{/* Toolbar */}
			<div className="flex items-center gap-2">
				<span className="text-sm font-medium">Overview</span>
			</div>

			{/* Size-proportional bar chart */}
			{sizedMilestones.length > 0 && (
				<div className="flex-1 min-h-0 overflow-auto rounded-md border">
					<div className="relative">
						{/* Header */}
						<div
							className="sticky top-0 z-20 flex border-b bg-background"
							style={{ height: HEADER_HEIGHT }}
						>
							<div
								className="shrink-0 border-r bg-background flex items-center px-3"
								style={{ width: LABEL_WIDTH }}
							>
								<span className="text-xs font-medium text-muted-foreground">
									Milestones
								</span>
							</div>
							<div className="flex-1 flex items-center px-3">
								<span className="text-xs font-medium text-muted-foreground">
									Size
								</span>
							</div>
						</div>

						{/* Rows */}
						{sizedRows.map((row) => {
							const isMilestone = row.type === "milestone";
							const rowHeight = isMilestone
								? ROW_HEIGHT
								: INITIATIVE_ROW_HEIGHT;
							const colorIndex = getMilestoneColorIndex(row.milestoneIndex);
							const milestone = isMilestone ? (row.item as Milestone) : null;
							const initiative = !isMilestone ? (row.item as Initiative) : null;

							// Compute bar width
							let barWidthPercent = 0;
							let sizeLabel = "";

							if (isMilestone && milestone) {
								const milestoneInitiatives =
									initiativesByMilestone.get(milestone.id) ?? [];
								const totalSize = getMilestoneSize(milestoneInitiatives);
								barWidthPercent =
									maxMilestoneSize > 0
										? (totalSize / maxMilestoneSize) * 100
										: 0;
								sizeLabel = String(totalSize);
							} else if (initiative) {
								const parentInitiatives =
									initiativesByMilestone.get(initiative.milestoneId) ?? [];
								const parentTotalSize = getMilestoneSize(parentInitiatives);
								const initiativeSize = initiative.size ?? 0;
								barWidthPercent =
									parentTotalSize > 0
										? (initiativeSize / parentTotalSize) * 100
										: 0;
								sizeLabel =
									initiative.size != null ? String(initiative.size) : "—";
							}

							return (
								<div
									key={row.item.id}
									className={cn(
										"flex border-b",
										isMilestone ? "bg-muted/30" : "bg-background",
									)}
									style={{ height: rowHeight }}
								>
									{/* Row label */}
									<div
										className={cn(
											"shrink-0 border-r flex items-center gap-1.5 px-3 overflow-hidden",
											isMilestone && "font-medium",
										)}
										style={{ width: LABEL_WIDTH }}
									>
										{isMilestone && milestone && (
											<>
												<button
													type="button"
													className="bg-transparent border-none p-0.5 cursor-pointer hover:text-foreground/80 rounded shrink-0"
													onClick={() => toggleMilestone(milestone.id)}
												>
													{collapsedMilestones.has(milestone.id) ? (
														<ChevronRight className="size-3.5" />
													) : (
														<ChevronDown className="size-3.5" />
													)}
												</button>
												<span className="text-sm truncate">
													{milestone.title}
												</span>
												<Badge
													variant="secondary"
													className="text-xs ml-auto shrink-0"
												>
													{
														(initiativesByMilestone.get(milestone.id) ?? [])
															.length
													}
												</Badge>
											</>
										)}
										{!isMilestone && initiative && (
											<button
												type="button"
												className="text-xs text-muted-foreground truncate pl-5 bg-transparent border-none p-0 cursor-pointer hover:text-foreground/80 text-left"
												onClick={() => onSelectInitiative?.(initiative)}
											>
												{initiative.title}
											</button>
										)}
									</div>

									{/* Bar area */}
									<div className="relative flex-1 flex items-center px-3">
										{barWidthPercent > 0 && (
											<div
												className={cn(
													"rounded-md text-white text-xs flex items-center overflow-hidden",
													isMilestone
														? MILESTONE_COLORS[colorIndex]
														: INITIATIVE_COLORS[colorIndex],
													isMilestone ? "h-6" : "h-4",
													!isMilestone && "cursor-pointer hover:opacity-80",
												)}
												style={{
													width: `${barWidthPercent}%`,
													minWidth: 4,
												}}
												title={`${row.item.title} — ${sizeLabel}`}
												{...(!isMilestone && initiative
													? {
															onClick: () => onSelectInitiative?.(initiative),
															onKeyDown: (e: React.KeyboardEvent) => {
																if (e.key === "Enter" || e.key === " ") {
																	e.preventDefault();
																	onSelectInitiative?.(initiative);
																}
															},
															role: "button" as const,
															tabIndex: 0,
														}
													: {})}
											>
												{barWidthPercent > 15 && (
													<span className="truncate px-1.5 text-xs font-medium">
														{sizeLabel}
													</span>
												)}
											</div>
										)}
										{(barWidthPercent <= 15 || barWidthPercent === 0) && (
											<span
												className="text-xs text-muted-foreground ml-1"
												style={{
													marginLeft:
														barWidthPercent > 0
															? `calc(${barWidthPercent}% + 4px)`
															: undefined,
												}}
											>
												{sizeLabel}
											</span>
										)}
									</div>
								</div>
							);
						})}
					</div>
				</div>
			)}

			{/* All milestones are unsized */}
			{sizedMilestones.length === 0 && unsizedMilestones.length > 0 && (
				<div className="flex items-center justify-center flex-1 rounded-lg border border-dashed">
					<div className="text-center space-y-2">
						<BarChart3 className="size-8 mx-auto text-muted-foreground" />
						<p className="text-muted-foreground">
							No milestones have sized initiatives
						</p>
						<p className="text-sm text-muted-foreground">
							Add sizes to your initiatives to see the overview chart.
						</p>
					</div>
				</div>
			)}

			{/* Unsized Milestones Section */}
			{unsizedMilestones.length > 0 && (
				<div className="rounded-md border">
					<div className="px-3 py-2 border-b bg-muted/40">
						<span className="text-xs font-medium text-muted-foreground">
							Unsized ({unsizedMilestones.length})
						</span>
					</div>
					<div className="divide-y">
						{unsizedMilestones.map((milestone) => {
							const milestoneInitiatives =
								initiativesByMilestone.get(milestone.id) ?? [];
							return (
								<div
									key={milestone.id}
									className="flex items-center gap-2 px-3 py-2"
								>
									<div
										className={cn(
											"size-2 rounded-full",
											MILESTONE_COLORS[
												getMilestoneColorIndex(
													milestones.findIndex((m) => m.id === milestone.id),
												)
											],
										)}
									/>
									<span className="text-sm">{milestone.title}</span>
									<Badge variant="secondary" className="text-xs ml-auto">
										{milestoneInitiatives.length}{" "}
										{milestoneInitiatives.length === 1
											? "initiative"
											: "initiatives"}
									</Badge>
								</div>
							);
						})}
					</div>
				</div>
			)}
		</div>
	);
}
