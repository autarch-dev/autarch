/**
 * TableView - Spreadsheet-style view of milestones and initiatives
 *
 * Groups initiatives under collapsible milestone headers.
 * Supports filtering by status/priority/text
 * and inline editing of cells (click to edit, blur/enter to save).
 */

import { ArrowDown, ArrowUp, ArrowUpDown, Plus, Search } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type {
	Initiative,
	InitiativePriority,
	InitiativeStatus,
	Milestone,
	RoadmapDependency,
} from "@/shared/schemas/roadmap";
import { MilestoneGroup } from "./MilestoneGroup";

// =============================================================================
// Types
// =============================================================================

type SortField = "title" | "status" | "priority" | "progress";
type SortDirection = "asc" | "desc";

interface SortConfig {
	field: SortField;
	direction: SortDirection;
}

interface TableViewProps {
	roadmapId: string;
	milestones: Milestone[];
	initiatives: Initiative[];
	dependencies: RoadmapDependency[];
	onUpdateMilestone: (
		milestoneId: string,
		data: Partial<Pick<Milestone, "title" | "description">>,
	) => Promise<void>;
	onUpdateInitiative: (
		initiativeId: string,
		data: Partial<
			Pick<Initiative, "title" | "status" | "priority" | "progress" | "size">
		> & { workflowId?: string | null },
	) => Promise<void>;
	onCreateMilestone: (data: {
		title: string;
		description?: string;
	}) => Promise<void>;
	onCreateInitiative: (
		milestoneId: string,
		data: { title: string },
	) => Promise<void>;
	onSelectInitiative?: (initiative: Initiative) => void;
	onDeleteMilestone: (milestoneId: string) => Promise<void>;
	onDeleteInitiative: (initiativeId: string) => Promise<void>;
	onReorderMilestones: (
		reorderedIds: { id: string; sortOrder: number }[],
	) => void;
	onReorderInitiatives: (
		milestoneId: string,
		reorderedIds: { id: string; sortOrder: number }[],
	) => void;
}

// =============================================================================
// Constants
// =============================================================================

const STATUS_OPTIONS: { value: InitiativeStatus; label: string }[] = [
	{ value: "not_started", label: "Not Started" },
	{ value: "in_progress", label: "In Progress" },
	{ value: "completed", label: "Completed" },
	{ value: "blocked", label: "Blocked" },
];

const PRIORITY_OPTIONS: { value: InitiativePriority; label: string }[] = [
	{ value: "low", label: "Low" },
	{ value: "medium", label: "Medium" },
	{ value: "high", label: "High" },
	{ value: "critical", label: "Critical" },
];

const STATUS_SORT_ORDER: Record<InitiativeStatus, number> = {
	blocked: 0,
	in_progress: 1,
	not_started: 2,
	completed: 3,
};

const PRIORITY_SORT_ORDER: Record<InitiativePriority, number> = {
	critical: 0,
	high: 1,
	medium: 2,
	low: 3,
};

// =============================================================================
// Helper: Get dependency names for an item
// =============================================================================

function getDependencyNames(
	itemId: string,
	itemType: "milestone" | "initiative",
	dependencies: RoadmapDependency[],
	milestones: Milestone[],
	initiatives: Initiative[],
): string[] {
	// Find dependencies where this item is the target (blocked by source)
	const blocking = dependencies.filter(
		(d) => d.targetId === itemId && d.targetType === itemType,
	);

	return blocking
		.map((dep) => {
			if (dep.sourceType === "milestone") {
				return milestones.find((m) => m.id === dep.sourceId)?.title;
			}
			return initiatives.find((i) => i.id === dep.sourceId)?.title;
		})
		.filter((name): name is string => name != null);
}

// =============================================================================
// Helper: Check if item has dependencies
// =============================================================================

function hasDependencies(
	itemId: string,
	itemType: "milestone" | "initiative",
	dependencies: RoadmapDependency[],
): boolean {
	return dependencies.some(
		(d) => d.targetId === itemId && d.targetType === itemType,
	);
}

// =============================================================================
// Sub-component: Sort Header
// =============================================================================

function SortableHeader({
	label,
	field,
	sort,
	onSort,
}: {
	label: string;
	field: SortField;
	sort: SortConfig | null;
	onSort: (field: SortField) => void;
}) {
	const isActive = sort?.field === field;

	return (
		<button
			type="button"
			className="flex items-center gap-1 bg-transparent border-none p-0 cursor-pointer hover:text-foreground font-medium text-sm"
			onClick={() => onSort(field)}
		>
			{label}
			{isActive && sort.direction === "asc" ? (
				<ArrowUp className="size-3.5" />
			) : isActive && sort.direction === "desc" ? (
				<ArrowDown className="size-3.5" />
			) : (
				<ArrowUpDown className="size-3.5 text-muted-foreground" />
			)}
		</button>
	);
}

// =============================================================================
// Component: TableView
// =============================================================================

export function TableView({
	roadmapId: _roadmapId,
	milestones,
	initiatives,
	dependencies,
	onUpdateMilestone,
	onUpdateInitiative,
	onCreateMilestone,
	onCreateInitiative,
	onSelectInitiative,
	onDeleteMilestone,
	onDeleteInitiative,
}: TableViewProps) {
	// -------------------------------------------------------------------------
	// State
	// -------------------------------------------------------------------------
	const [collapsedMilestones, setCollapsedMilestones] = useState<Set<string>>(
		new Set(),
	);
	const [sort, setSort] = useState<SortConfig | null>(null);
	const [filterStatus, setFilterStatus] = useState<string>("all");
	const [filterPriority, setFilterPriority] = useState<string>("all");
	const [searchText, setSearchText] = useState("");
	const [deleteTarget, setDeleteTarget] = useState<{
		type: "milestone" | "initiative";
		id: string;
		title: string;
	} | null>(null);

	// -------------------------------------------------------------------------
	// Handlers
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

	const handleSort = useCallback((field: SortField) => {
		setSort((prev) => {
			if (prev?.field === field) {
				if (prev.direction === "asc") return { field, direction: "desc" };
				return null; // Clear sort on third click
			}
			return { field, direction: "asc" };
		});
	}, []);

	const handleCreateMilestone = useCallback(async () => {
		await onCreateMilestone({ title: "New Milestone" });
	}, [onCreateMilestone]);

	const handleCreateInitiative = useCallback(
		async (milestoneId: string) => {
			await onCreateInitiative(milestoneId, { title: "New Initiative" });
		},
		[onCreateInitiative],
	);

	// -------------------------------------------------------------------------
	// Filtering + Sorting
	// -------------------------------------------------------------------------
	const filteredInitiatives = useMemo(() => {
		let filtered = initiatives;

		if (filterStatus !== "all") {
			filtered = filtered.filter((i) => i.status === filterStatus);
		}

		if (filterPriority !== "all") {
			filtered = filtered.filter((i) => i.priority === filterPriority);
		}

		if (searchText.trim()) {
			const search = searchText.trim().toLowerCase();
			filtered = filtered.filter((i) => i.title.toLowerCase().includes(search));
		}

		if (sort) {
			filtered = [...filtered].sort((a, b) => {
				let cmp = 0;
				switch (sort.field) {
					case "title":
						cmp = a.title.localeCompare(b.title);
						break;
					case "status":
						cmp = STATUS_SORT_ORDER[a.status] - STATUS_SORT_ORDER[b.status];
						break;
					case "priority":
						cmp =
							PRIORITY_SORT_ORDER[a.priority] - PRIORITY_SORT_ORDER[b.priority];
						break;
					case "progress":
						cmp = a.progress - b.progress;
						break;
				}
				return sort.direction === "desc" ? -cmp : cmp;
			});
		}

		return filtered;
	}, [initiatives, filterStatus, filterPriority, searchText, sort]);

	// Group filtered initiatives by milestone
	const initiativesByMilestone = useMemo(() => {
		const grouped = new Map<string, Initiative[]>();
		for (const milestone of milestones) {
			grouped.set(milestone.id, []);
		}
		for (const initiative of filteredInitiatives) {
			const list = grouped.get(initiative.milestoneId);
			if (list) {
				list.push(initiative);
			}
		}
		return grouped;
	}, [milestones, filteredInitiatives]);

	// Sort milestones by sortOrder
	const sortedMilestones = useMemo(
		() => [...milestones].sort((a, b) => a.sortOrder - b.sortOrder),
		[milestones],
	);

	// Check if any filters are active
	const hasActiveFilters =
		filterStatus !== "all" ||
		filterPriority !== "all" ||
		searchText.trim() !== "";

	// -------------------------------------------------------------------------
	// Render
	// -------------------------------------------------------------------------
	return (
		<div className="flex flex-col gap-3 h-full">
			{/* Filter Bar */}
			<div className="flex items-center gap-2 flex-wrap">
				<div className="relative flex-1 min-w-[200px] max-w-[300px]">
					<Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
					<Input
						placeholder="Search initiatives..."
						value={searchText}
						onChange={(e) => setSearchText(e.target.value)}
						className="h-8 pl-8 text-sm"
					/>
				</div>

				<Select value={filterStatus} onValueChange={setFilterStatus}>
					<SelectTrigger size="sm" className="h-8 w-[140px]">
						<SelectValue placeholder="Status" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All Statuses</SelectItem>
						{STATUS_OPTIONS.map((opt) => (
							<SelectItem key={opt.value} value={opt.value}>
								{opt.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>

				<Select value={filterPriority} onValueChange={setFilterPriority}>
					<SelectTrigger size="sm" className="h-8 w-[140px]">
						<SelectValue placeholder="Priority" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All Priorities</SelectItem>
						{PRIORITY_OPTIONS.map((opt) => (
							<SelectItem key={opt.value} value={opt.value}>
								{opt.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>

				{hasActiveFilters && (
					<Button
						variant="ghost"
						size="sm"
						className="h-8 text-xs"
						onClick={() => {
							setFilterStatus("all");
							setFilterPriority("all");
							setSearchText("");
						}}
					>
						Clear filters
					</Button>
				)}

				<div className="flex-1" />

				<Button
					variant="outline"
					size="sm"
					className="h-8"
					onClick={handleCreateMilestone}
				>
					<Plus className="size-3.5 mr-1" />
					New Milestone
				</Button>
			</div>

			{/* Table */}
			<div className="flex-1 min-h-0 overflow-auto rounded-md border">
				<Table>
					<TableHeader className="sticky top-0 z-10 bg-background">
						<TableRow>
							<TableHead className="w-[400px]">
								<SortableHeader
									label="Title"
									field="title"
									sort={sort}
									onSort={handleSort}
								/>
							</TableHead>
							<TableHead className="w-[120px]">
								<SortableHeader
									label="Status"
									field="status"
									sort={sort}
									onSort={handleSort}
								/>
							</TableHead>
							<TableHead className="w-[110px]">
								<SortableHeader
									label="Priority"
									field="priority"
									sort={sort}
									onSort={handleSort}
								/>
							</TableHead>
							<TableHead className="w-[90px]">Size</TableHead>
							<TableHead className="w-[180px]">Dependencies</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{sortedMilestones.length === 0 ? (
							<TableRow>
								<TableCell
									colSpan={6}
									className="h-24 text-center text-muted-foreground"
								>
									No milestones yet. Create one to get started.
								</TableCell>
							</TableRow>
						) : (
							sortedMilestones.map((milestone) => {
								const isCollapsed = collapsedMilestones.has(milestone.id);
								const milestoneInitiatives =
									initiativesByMilestone.get(milestone.id) ?? [];
								const milestoneDepNames = getDependencyNames(
									milestone.id,
									"milestone",
									dependencies,
									milestones,
									initiatives,
								);
								const hasMilestoneDeps = hasDependencies(
									milestone.id,
									"milestone",
									dependencies,
								);

								return (
									<MilestoneGroup
										key={milestone.id}
										milestone={milestone}
										initiatives={milestoneInitiatives}
										dependencies={dependencies}
										allMilestones={milestones}
										allInitiatives={initiatives}
										dependencyNames={milestoneDepNames}
										hasDependencies={hasMilestoneDeps}
										isCollapsed={isCollapsed}
										onToggle={() => toggleMilestone(milestone.id)}
										onUpdateMilestone={onUpdateMilestone}
										onUpdateInitiative={onUpdateInitiative}
										onCreateInitiative={() =>
											handleCreateInitiative(milestone.id)
										}
										onSelectInitiative={onSelectInitiative}
										onRequestDeleteMilestone={(id, title) =>
											setDeleteTarget({ type: "milestone", id, title })
										}
										onRequestDeleteInitiative={(id, title) =>
											setDeleteTarget({ type: "initiative", id, title })
										}
									/>
								);
							})
						)}
					</TableBody>
				</Table>
			</div>

			{/* Delete Confirmation Dialog */}
			<Dialog
				open={deleteTarget !== null}
				onOpenChange={(open) => {
					if (!open) setDeleteTarget(null);
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							Delete{" "}
							{deleteTarget?.type === "milestone" ? "Milestone" : "Initiative"}
						</DialogTitle>
						<DialogDescription>
							Are you sure you want to delete &ldquo;{deleteTarget?.title}
							&rdquo;? This action cannot be undone.
							{deleteTarget?.type === "milestone" &&
								" All initiatives in this milestone will also be deleted."}
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={() => setDeleteTarget(null)}>
							Cancel
						</Button>
						<Button
							variant="destructive"
							onClick={async () => {
								if (!deleteTarget) return;
								if (deleteTarget.type === "milestone") {
									await onDeleteMilestone(deleteTarget.id);
								} else {
									await onDeleteInitiative(deleteTarget.id);
								}
								setDeleteTarget(null);
							}}
						>
							Delete
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
