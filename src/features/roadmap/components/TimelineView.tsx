/**
 * TimelineView - Horizontal time-based visualization of roadmap milestones and initiatives
 *
 * Uses CSS Grid for layout with time on the X axis and milestones/initiatives stacked
 * on the Y axis. Features dependency arrows via SVG overlay, a today marker, zoom controls,
 * and support for unscheduled milestones.
 */

import {
	Calendar,
	ChevronDown,
	ChevronRight,
	ZoomIn,
	ZoomOut,
} from "lucide-react";
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
	Initiative,
	Milestone,
	RoadmapDependency,
} from "@/shared/schemas/roadmap";

// =============================================================================
// Types
// =============================================================================

type TimeGranularity = "week" | "month" | "quarter";

interface TimelineViewProps {
	roadmapId: string;
	milestones: Milestone[];
	initiatives: Initiative[];
	dependencies: RoadmapDependency[];
	onSelectInitiative?: (initiative: Initiative) => void;
}

interface TimeColumn {
	label: string;
	start: number;
	end: number;
}

interface ArrowPosition {
	id: string;
	x1: number;
	y1: number;
	x2: number;
	y2: number;
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

const COLUMN_MIN_WIDTH: Record<TimeGranularity, number> = {
	week: 80,
	month: 120,
	quarter: 160,
};

const ROW_HEIGHT = 40;
const INITIATIVE_ROW_HEIGHT = 32;
const HEADER_HEIGHT = 48;
const LABEL_WIDTH = 200;

const MS_PER_DAY = 86400000;
const MS_PER_WEEK = MS_PER_DAY * 7;

// =============================================================================
// Helpers: Time computation
// =============================================================================

function startOfDay(ts: number): number {
	const d = new Date(ts);
	d.setHours(0, 0, 0, 0);
	return d.getTime();
}

function startOfWeek(ts: number): number {
	const d = new Date(ts);
	const day = d.getDay();
	d.setDate(d.getDate() - day);
	d.setHours(0, 0, 0, 0);
	return d.getTime();
}

function startOfMonth(ts: number): number {
	const d = new Date(ts);
	d.setDate(1);
	d.setHours(0, 0, 0, 0);
	return d.getTime();
}

function startOfQuarter(ts: number): number {
	const d = new Date(ts);
	const quarter = Math.floor(d.getMonth() / 3);
	d.setMonth(quarter * 3, 1);
	d.setHours(0, 0, 0, 0);
	return d.getTime();
}

function endOfWeek(ts: number): number {
	return startOfWeek(ts) + MS_PER_WEEK;
}

function endOfMonth(ts: number): number {
	const d = new Date(ts);
	d.setMonth(d.getMonth() + 1, 1);
	d.setHours(0, 0, 0, 0);
	return d.getTime();
}

function endOfQuarter(ts: number): number {
	const d = new Date(ts);
	const quarter = Math.floor(d.getMonth() / 3);
	d.setMonth((quarter + 1) * 3, 1);
	d.setHours(0, 0, 0, 0);
	return d.getTime();
}

function formatWeekLabel(ts: number): string {
	const d = new Date(ts);
	return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatMonthLabel(ts: number): string {
	const d = new Date(ts);
	return d.toLocaleDateString(undefined, {
		month: "short",
		year: "numeric",
	});
}

function formatQuarterLabel(ts: number): string {
	const d = new Date(ts);
	const quarter = Math.floor(d.getMonth() / 3) + 1;
	return `Q${quarter} ${d.getFullYear()}`;
}

function generateTimeColumns(
	rangeStart: number,
	rangeEnd: number,
	granularity: TimeGranularity,
): TimeColumn[] {
	const columns: TimeColumn[] = [];

	let current: number;
	let getEnd: (ts: number) => number;
	let getLabel: (ts: number) => string;

	switch (granularity) {
		case "week":
			current = startOfWeek(rangeStart);
			getEnd = endOfWeek;
			getLabel = formatWeekLabel;
			break;
		case "month":
			current = startOfMonth(rangeStart);
			getEnd = endOfMonth;
			getLabel = formatMonthLabel;
			break;
		case "quarter":
			current = startOfQuarter(rangeStart);
			getEnd = endOfQuarter;
			getLabel = formatQuarterLabel;
			break;
	}

	// Safety limit to prevent infinite loops
	const maxColumns = 200;
	while (current < rangeEnd && columns.length < maxColumns) {
		const end = getEnd(current);
		columns.push({
			label: getLabel(current),
			start: current,
			end,
		});
		current = end;
	}

	return columns;
}

function getColumnPosition(
	timestamp: number,
	columns: TimeColumn[],
): number | null {
	if (columns.length === 0) return null;

	const first = columns[0];
	const last = columns[columns.length - 1];
	if (!first || !last) return null;

	const totalStart = first.start;
	const totalEnd = last.end;
	const totalRange = totalEnd - totalStart;

	if (totalRange <= 0) return null;

	const clamped = Math.max(totalStart, Math.min(totalEnd, timestamp));
	// Returns a fractional column index (0-based)
	return ((clamped - totalStart) / totalRange) * columns.length;
}

// =============================================================================
// Helpers: Milestone color assignment
// =============================================================================

function getMilestoneColorIndex(milestoneIndex: number): number {
	return milestoneIndex % MILESTONE_COLORS.length;
}

// =============================================================================
// Component: TimelineView
// =============================================================================

export function TimelineView({
	roadmapId: _roadmapId,
	milestones,
	initiatives,
	dependencies,
	onSelectInitiative,
}: TimelineViewProps) {
	const [granularity, setGranularity] = useState<TimeGranularity>("month");
	const [collapsedMilestones, setCollapsedMilestones] = useState<Set<string>>(
		new Set(),
	);
	const [arrows, setArrows] = useState<ArrowPosition[]>([]);

	const gridRef = useRef<HTMLDivElement>(null);
	const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());

	// -------------------------------------------------------------------------
	// Separate scheduled and unscheduled milestones
	// -------------------------------------------------------------------------
	const { scheduledMilestones, unscheduledMilestones } = useMemo(() => {
		const scheduled: Milestone[] = [];
		const unscheduled: Milestone[] = [];

		const sorted = [...milestones].sort((a, b) => a.sortOrder - b.sortOrder);
		for (const m of sorted) {
			if (m.startDate != null && m.endDate != null) {
				scheduled.push(m);
			} else {
				unscheduled.push(m);
			}
		}

		return {
			scheduledMilestones: scheduled,
			unscheduledMilestones: unscheduled,
		};
	}, [milestones]);

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
	// Compute time range and columns
	// -------------------------------------------------------------------------
	const timeColumns = useMemo(() => {
		if (scheduledMilestones.length === 0) return [];

		let rangeStart = Number.POSITIVE_INFINITY;
		let rangeEnd = Number.NEGATIVE_INFINITY;

		for (const m of scheduledMilestones) {
			if (m.startDate != null) rangeStart = Math.min(rangeStart, m.startDate);
			if (m.endDate != null) rangeEnd = Math.max(rangeEnd, m.endDate);
		}

		if (!Number.isFinite(rangeStart) || !Number.isFinite(rangeEnd)) return [];

		// Add padding: one unit before and after
		const paddingMs =
			granularity === "week"
				? MS_PER_WEEK
				: granularity === "month"
					? MS_PER_DAY * 30
					: MS_PER_DAY * 90;

		return generateTimeColumns(
			rangeStart - paddingMs,
			rangeEnd + paddingMs,
			granularity,
		);
	}, [scheduledMilestones, granularity]);

	// -------------------------------------------------------------------------
	// Today marker position
	// -------------------------------------------------------------------------
	const todayPosition = useMemo(() => {
		if (timeColumns.length === 0) return null;
		const now = startOfDay(Date.now());
		return getColumnPosition(now, timeColumns);
	}, [timeColumns]);

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
	// Zoom controls
	// -------------------------------------------------------------------------
	const zoomIn = useCallback(() => {
		setGranularity((prev) => {
			if (prev === "quarter") return "month";
			if (prev === "month") return "week";
			return prev;
		});
	}, []);

	const zoomOut = useCallback(() => {
		setGranularity((prev) => {
			if (prev === "week") return "month";
			if (prev === "month") return "quarter";
			return prev;
		});
	}, []);

	// -------------------------------------------------------------------------
	// Ref registration helper
	// -------------------------------------------------------------------------
	const setItemRef = useCallback(
		(id: string) => (el: HTMLDivElement | null) => {
			if (el) {
				itemRefs.current.set(id, el);
			} else {
				itemRefs.current.delete(id);
			}
		},
		[],
	);

	// -------------------------------------------------------------------------
	// Compute dependency arrows after layout
	// -------------------------------------------------------------------------
	const computeArrows = useCallback(() => {
		if (!gridRef.current || dependencies.length === 0) {
			setArrows([]);
			return;
		}

		const gridRect = gridRef.current.getBoundingClientRect();
		const newArrows: ArrowPosition[] = [];

		for (const dep of dependencies) {
			const sourceEl = itemRefs.current.get(dep.sourceId);
			const targetEl = itemRefs.current.get(dep.targetId);

			if (!sourceEl || !targetEl) continue;

			const sourceRect = sourceEl.getBoundingClientRect();
			const targetRect = targetEl.getBoundingClientRect();

			newArrows.push({
				id: dep.id,
				x1: sourceRect.right - gridRect.left,
				y1: sourceRect.top + sourceRect.height / 2 - gridRect.top,
				x2: targetRect.left - gridRect.left,
				y2: targetRect.top + targetRect.height / 2 - gridRect.top,
			});
		}

		setArrows(newArrows);
	}, [dependencies]);

	useLayoutEffect(() => {
		computeArrows();
	}, [computeArrows]);

	useEffect(() => {
		const handleResize = () => computeArrows();
		window.addEventListener("resize", handleResize);
		return () => window.removeEventListener("resize", handleResize);
	}, [computeArrows]);

	// -------------------------------------------------------------------------
	// Empty state
	// -------------------------------------------------------------------------
	if (milestones.length === 0) {
		return (
			<div className="flex items-center justify-center h-full rounded-lg border border-dashed">
				<div className="text-center space-y-2">
					<Calendar className="size-8 mx-auto text-muted-foreground" />
					<p className="text-muted-foreground">No milestones yet</p>
					<p className="text-sm text-muted-foreground">
						Create milestones with start and end dates to see the timeline view.
					</p>
				</div>
			</div>
		);
	}

	// -------------------------------------------------------------------------
	// Build row layout for scheduled milestones
	// -------------------------------------------------------------------------
	const scheduledRows: Array<{
		type: "milestone" | "initiative";
		item: Milestone | Initiative;
		milestoneIndex: number;
	}> = [];

	for (let mi = 0; mi < scheduledMilestones.length; mi++) {
		const milestone = scheduledMilestones[mi];
		if (!milestone) continue;
		scheduledRows.push({
			type: "milestone",
			item: milestone,
			milestoneIndex: mi,
		});

		if (!collapsedMilestones.has(milestone.id)) {
			const milestoneInitiatives =
				initiativesByMilestone.get(milestone.id) ?? [];
			for (const initiative of milestoneInitiatives) {
				scheduledRows.push({
					type: "initiative",
					item: initiative,
					milestoneIndex: mi,
				});
			}
		}
	}

	const columnWidth = COLUMN_MIN_WIDTH[granularity];
	const totalGridWidth = timeColumns.length * columnWidth;

	return (
		<div className="flex flex-col gap-3 h-full">
			{/* Toolbar */}
			<div className="flex items-center gap-2">
				<span className="text-sm text-muted-foreground">Zoom:</span>
				<Button
					variant="outline"
					size="icon-sm"
					onClick={zoomIn}
					disabled={granularity === "week"}
					title="Zoom in"
				>
					<ZoomIn className="size-4" />
				</Button>
				<Button
					variant="outline"
					size="icon-sm"
					onClick={zoomOut}
					disabled={granularity === "quarter"}
					title="Zoom out"
				>
					<ZoomOut className="size-4" />
				</Button>
				<Badge variant="secondary" className="text-xs capitalize">
					{granularity}
				</Badge>

				<div className="flex-1" />

				<span className="text-xs text-muted-foreground">
					{scheduledMilestones.length} scheduled ·{" "}
					{unscheduledMilestones.length} unscheduled
				</span>
			</div>

			{/* Timeline Grid */}
			{scheduledMilestones.length > 0 && timeColumns.length > 0 && (
				<div className="flex-1 min-h-0 overflow-auto rounded-md border">
					<div
						ref={gridRef}
						className="relative"
						style={{
							minWidth: LABEL_WIDTH + totalGridWidth,
						}}
					>
						{/* Column Headers */}
						<div
							className="sticky top-0 z-20 flex border-b bg-background"
							style={{ height: HEADER_HEIGHT }}
						>
							{/* Label spacer */}
							<div
								className="shrink-0 border-r bg-background flex items-center px-3"
								style={{ width: LABEL_WIDTH }}
							>
								<span className="text-xs font-medium text-muted-foreground">
									Milestones
								</span>
							</div>
							{/* Time columns */}
							<div className="flex">
								{timeColumns.map((col, i) => (
									<div
										key={`${col.label}-${i}`}
										className="shrink-0 flex items-center justify-center border-r text-xs text-muted-foreground"
										style={{ width: columnWidth, height: HEADER_HEIGHT }}
									>
										{col.label}
									</div>
								))}
							</div>
						</div>

						{/* Rows */}
						{scheduledRows.map((row) => {
							const isMilestone = row.type === "milestone";
							const rowHeight = isMilestone
								? ROW_HEIGHT
								: INITIATIVE_ROW_HEIGHT;
							const colorIndex = getMilestoneColorIndex(row.milestoneIndex);
							const milestone = isMilestone ? (row.item as Milestone) : null;
							const initiative = !isMilestone ? (row.item as Initiative) : null;

							// Compute bar position
							const parentMilestone = isMilestone
								? (row.item as Milestone)
								: scheduledMilestones.find(
										(m) => m.id === (row.item as Initiative).milestoneId,
									);

							const barStartTs = parentMilestone?.startDate;
							const barEndTs = parentMilestone?.endDate;

							const barStart =
								barStartTs != null
									? getColumnPosition(barStartTs, timeColumns)
									: null;
							const barEnd =
								barEndTs != null
									? getColumnPosition(barEndTs, timeColumns)
									: null;

							const hasBar = barStart != null && barEnd != null;

							// For initiatives, position them proportionally within milestone span
							let initiativeBarStart = barStart;
							let initiativeBarEnd = barEnd;
							if (!isMilestone && hasBar && initiative) {
								const milestoneInitiatives =
									initiativesByMilestone.get(initiative.milestoneId) ?? [];
								const initiativeIndex = milestoneInitiatives.findIndex(
									(init) => init.id === initiative.id,
								);
								const totalInitiatives = milestoneInitiatives.length;

								if (
									totalInitiatives > 0 &&
									barStart != null &&
									barEnd != null
								) {
									const span = barEnd - barStart;
									// Distribute initiatives evenly within the milestone span
									const segmentSize = span / totalInitiatives;
									initiativeBarStart = barStart + initiativeIndex * segmentSize;
									initiativeBarEnd =
										barStart + (initiativeIndex + 1) * segmentSize;
								}
							}

							const finalBarStart = isMilestone ? barStart : initiativeBarStart;
							const finalBarEnd = isMilestone ? barEnd : initiativeBarEnd;
							const hasFinalBar = finalBarStart != null && finalBarEnd != null;

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

									{/* Grid area with bar */}
									<div className="relative flex-1">
										{/* Column grid lines */}
										<div className="absolute inset-0 flex pointer-events-none">
											{timeColumns.map((col, i) => (
												<div
													key={`grid-${col.label}-${i}`}
													className="shrink-0 border-r border-border/30"
													style={{
														width: columnWidth,
														height: rowHeight,
													}}
												/>
											))}
										</div>

										{/* Bar */}
										{hasFinalBar && (
											<div
												ref={setItemRef(row.item.id)}
												className={cn(
													"absolute top-1/2 -translate-y-1/2 rounded-md text-white text-xs flex items-center justify-center overflow-hidden",
													isMilestone
														? MILESTONE_COLORS[colorIndex]
														: INITIATIVE_COLORS[colorIndex],
													isMilestone ? "h-6" : "h-4",
													!isMilestone && "cursor-pointer hover:opacity-80",
												)}
												style={{
													left: finalBarStart * columnWidth,
													width: Math.max(
														(finalBarEnd - finalBarStart) * columnWidth,
														4,
													),
												}}
												title={row.item.title}
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
												{isMilestone &&
													(finalBarEnd - finalBarStart) * columnWidth > 60 && (
														<span className="truncate px-1.5 text-xs font-medium">
															{row.item.title}
														</span>
													)}
											</div>
										)}

										{/* Placeholder for milestones without a visible bar (shouldn't happen in scheduled) */}
										{!hasFinalBar && isMilestone && (
											<div
												ref={setItemRef(row.item.id)}
												className="absolute top-1/2 -translate-y-1/2 left-2 h-6 w-16 rounded-md bg-muted border border-dashed border-border flex items-center justify-center"
											>
												<span className="text-xs text-muted-foreground">—</span>
											</div>
										)}
									</div>
								</div>
							);
						})}

						{/* Today Marker */}
						{todayPosition != null && (
							<div
								className="absolute z-10 pointer-events-none"
								style={{
									left: LABEL_WIDTH + todayPosition * columnWidth,
									top: 0,
									bottom: 0,
									width: 2,
								}}
							>
								<div className="w-full h-full bg-red-500/70" />
								<div className="absolute -top-0 -left-[9px] text-[9px] text-red-600 dark:text-red-400 font-medium bg-background px-1 rounded border border-red-300 dark:border-red-700 whitespace-nowrap">
									Today
								</div>
							</div>
						)}

						{/* Dependency Arrows SVG Overlay */}
						{arrows.length > 0 && (
							<svg
								className="absolute inset-0 pointer-events-none z-10"
								role="img"
								aria-label="Dependency arrows between milestones and initiatives"
								style={{
									width: "100%",
									height: "100%",
									overflow: "visible",
								}}
							>
								<defs>
									<marker
										id="timeline-arrowhead"
										markerWidth="8"
										markerHeight="6"
										refX="8"
										refY="3"
										orient="auto"
									>
										<path
											d="M0,0 L8,3 L0,6 Z"
											className="fill-slate-400 dark:fill-slate-500"
										/>
									</marker>
								</defs>
								{arrows.map((arrow) => (
									<line
										key={arrow.id}
										x1={arrow.x1}
										y1={arrow.y1}
										x2={arrow.x2}
										y2={arrow.y2}
										className="stroke-slate-400 dark:stroke-slate-500"
										strokeWidth={1.5}
										markerEnd="url(#timeline-arrowhead)"
									/>
								))}
							</svg>
						)}
					</div>
				</div>
			)}

			{/* All milestones are unscheduled */}
			{scheduledMilestones.length === 0 && unscheduledMilestones.length > 0 && (
				<div className="flex items-center justify-center flex-1 rounded-lg border border-dashed">
					<div className="text-center space-y-2">
						<Calendar className="size-8 mx-auto text-muted-foreground" />
						<p className="text-muted-foreground">
							No milestones have dates set
						</p>
						<p className="text-sm text-muted-foreground">
							Add start and end dates to your milestones to see them on the
							timeline.
						</p>
					</div>
				</div>
			)}

			{/* Unscheduled Milestones Section */}
			{unscheduledMilestones.length > 0 && (
				<div className="rounded-md border">
					<div className="px-3 py-2 border-b bg-muted/40">
						<span className="text-xs font-medium text-muted-foreground">
							Unscheduled ({unscheduledMilestones.length})
						</span>
					</div>
					<div className="divide-y">
						{unscheduledMilestones.map((milestone) => {
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
									<span className="text-xs text-muted-foreground">
										No dates set
									</span>
								</div>
							);
						})}
					</div>
				</div>
			)}
		</div>
	);
}
