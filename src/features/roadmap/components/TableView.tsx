/**
 * TableView - Spreadsheet-style view of milestones and initiatives
 *
 * Groups initiatives under collapsible milestone headers.
 * Supports sorting by column headers, filtering by status/priority/text,
 * and inline editing of cells (click to edit, blur/enter to save).
 */

import {
	closestCenter,
	DndContext,
	type DragEndEvent,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	arrayMove,
	SortableContext,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
	ArrowDown,
	ArrowUp,
	ArrowUpDown,
	ChevronDown,
	ChevronRight,
	GitBranch,
	GripVertical,
	MoreHorizontal,
	Plus,
	Search,
	Trash2,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
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
import { cn } from "@/lib/utils";
import type {
	Initiative,
	InitiativePriority,
	InitiativeStatus,
	Milestone,
	RoadmapDependency,
} from "@/shared/schemas/roadmap";

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
		>,
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

const STATUS_COLORS: Record<InitiativeStatus, string> = {
	not_started: "text-muted-foreground bg-muted",
	in_progress: "text-blue-700 bg-blue-100 dark:text-blue-400 dark:bg-blue-950",
	completed:
		"text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-950",
	blocked: "text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-950",
};

const PRIORITY_COLORS: Record<InitiativePriority, string> = {
	low: "text-muted-foreground bg-muted",
	medium: "text-blue-700 bg-blue-100 dark:text-blue-400 dark:bg-blue-950",
	high: "text-orange-700 bg-orange-100 dark:text-orange-400 dark:bg-orange-950",
	critical: "text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-950",
};

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

const FIBONACCI_SIZES = [1, 2, 3, 5, 8, 13, 21] as const;

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
// Sub-component: Editable Text Cell
// =============================================================================

function EditableTextCell({
	value,
	onSave,
	className,
}: {
	value: string;
	onSave: (value: string) => void;
	className?: string;
}) {
	const [isEditing, setIsEditing] = useState(false);
	const [editValue, setEditValue] = useState(value);

	const handleStartEdit = () => {
		setEditValue(value);
		setIsEditing(true);
	};

	const handleSave = () => {
		const trimmed = editValue.trim();
		if (trimmed && trimmed !== value) {
			onSave(trimmed);
		}
		setIsEditing(false);
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			handleSave();
		} else if (e.key === "Escape") {
			setEditValue(value);
			setIsEditing(false);
		}
	};

	if (isEditing) {
		return (
			<Input
				value={editValue}
				onChange={(e) => setEditValue(e.target.value)}
				onBlur={handleSave}
				onKeyDown={handleKeyDown}
				className={cn("h-7 text-sm", className)}
				autoFocus
			/>
		);
	}

	return (
		<button
			type="button"
			className={cn(
				"text-left bg-transparent border-none p-0 cursor-pointer hover:text-foreground/80 truncate",
				className,
			)}
			onClick={handleStartEdit}
			title="Click to edit"
		>
			{value}
		</button>
	);
}

// =============================================================================
// Sub-component: Inline Status Select
// =============================================================================

function StatusSelect({
	value,
	onSave,
}: {
	value: InitiativeStatus;
	onSave: (value: InitiativeStatus) => void;
}) {
	const option = STATUS_OPTIONS.find((o) => o.value === value);

	return (
		<Select value={value} onValueChange={(v) => onSave(v as InitiativeStatus)}>
			<SelectTrigger
				size="sm"
				className="h-7 text-xs border-none shadow-none px-0 gap-1 w-auto"
			>
				<SelectValue>
					<Badge
						variant="secondary"
						className={cn("text-xs", STATUS_COLORS[value])}
					>
						{option?.label ?? value}
					</Badge>
				</SelectValue>
			</SelectTrigger>
			<SelectContent>
				{STATUS_OPTIONS.map((opt) => (
					<SelectItem key={opt.value} value={opt.value}>
						<Badge
							variant="secondary"
							className={cn("text-xs", STATUS_COLORS[opt.value])}
						>
							{opt.label}
						</Badge>
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}

// =============================================================================
// Sub-component: Inline Priority Select
// =============================================================================

function PrioritySelect({
	value,
	onSave,
}: {
	value: InitiativePriority;
	onSave: (value: InitiativePriority) => void;
}) {
	const option = PRIORITY_OPTIONS.find((o) => o.value === value);

	return (
		<Select
			value={value}
			onValueChange={(v) => onSave(v as InitiativePriority)}
		>
			<SelectTrigger
				size="sm"
				className="h-7 text-xs border-none shadow-none px-0 gap-1 w-auto"
			>
				<SelectValue>
					<Badge
						variant="secondary"
						className={cn("text-xs", PRIORITY_COLORS[value])}
					>
						{option?.label ?? value}
					</Badge>
				</SelectValue>
			</SelectTrigger>
			<SelectContent>
				{PRIORITY_OPTIONS.map((opt) => (
					<SelectItem key={opt.value} value={opt.value}>
						<Badge
							variant="secondary"
							className={cn("text-xs", PRIORITY_COLORS[opt.value])}
						>
							{opt.label}
						</Badge>
					</SelectItem>
				))}
			</SelectContent>
		</Select>
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
	onReorderMilestones,
	onReorderInitiatives,
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
	// DnD Sensors
	// -------------------------------------------------------------------------
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
		useSensor(KeyboardSensor),
	);

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

	// -------------------------------------------------------------------------
	// DnD Handlers
	// -------------------------------------------------------------------------
	const handleMilestoneDragEnd = useCallback(
		(event: DragEndEvent) => {
			const { active, over } = event;
			if (!over || active.id === over.id) return;

			const oldIndex = sortedMilestones.findIndex((m) => m.id === active.id);
			const newIndex = sortedMilestones.findIndex((m) => m.id === over.id);
			if (oldIndex === -1 || newIndex === -1) return;

			const reordered = arrayMove(sortedMilestones, oldIndex, newIndex);
			const updates = reordered
				.map((m, i) => ({ id: m.id, sortOrder: i }))
				.filter((_u, i) => sortedMilestones[i]?.id !== reordered[i]?.id);
			if (updates.length > 0) {
				onReorderMilestones(updates);
			}
		},
		[sortedMilestones, onReorderMilestones],
	);

	const handleInitiativeDragEnd = useCallback(
		(milestoneId: string, currentInitiatives: Initiative[]) =>
			(event: DragEndEvent) => {
				const { active, over } = event;
				if (!over || active.id === over.id) return;

				const sorted = [...currentInitiatives].sort(
					(a, b) => a.sortOrder - b.sortOrder,
				);
				const oldIndex = sorted.findIndex((i) => i.id === active.id);
				const newIndex = sorted.findIndex((i) => i.id === over.id);
				if (oldIndex === -1 || newIndex === -1) return;

				const reordered = arrayMove(sorted, oldIndex, newIndex);
				const updates = reordered
					.map((item, i) => ({ id: item.id, sortOrder: i }))
					.filter((_u, i) => sorted[i]?.id !== reordered[i]?.id);
				if (updates.length > 0) {
					onReorderInitiatives(milestoneId, updates);
				}
			},
		[onReorderInitiatives],
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
							<TableHead className="w-[140px]">
								<SortableHeader
									label="Progress"
									field="progress"
									sort={sort}
									onSort={handleSort}
								/>
							</TableHead>
							<TableHead className="w-[90px]">Size</TableHead>
							<TableHead className="w-[180px]">Dependencies</TableHead>
						</TableRow>
					</TableHeader>
					<DndContext
						sensors={sensors}
						collisionDetection={closestCenter}
						onDragEnd={handleMilestoneDragEnd}
					>
						<SortableContext
							items={sortedMilestones.map((m) => m.id)}
							strategy={verticalListSortingStrategy}
						>
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
												sensors={sensors}
												onInitiativeDragEnd={handleInitiativeDragEnd(
													milestone.id,
													milestoneInitiatives,
												)}
											/>
										);
									})
								)}
							</TableBody>
						</SortableContext>
					</DndContext>
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

// =============================================================================
// Sub-component: Milestone Group (header row + initiative rows)
// =============================================================================

function MilestoneGroup({
	milestone,
	initiatives,
	dependencies,
	allMilestones,
	allInitiatives,
	dependencyNames,
	hasDependencies: hasDeps,
	isCollapsed,
	onToggle,
	onUpdateMilestone,
	onUpdateInitiative,
	onCreateInitiative,
	onSelectInitiative,
	onRequestDeleteMilestone,
	onRequestDeleteInitiative,
	sensors,
	onInitiativeDragEnd,
}: {
	milestone: Milestone;
	initiatives: Initiative[];
	dependencies: RoadmapDependency[];
	allMilestones: Milestone[];
	allInitiatives: Initiative[];
	dependencyNames: string[];
	hasDependencies: boolean;
	isCollapsed: boolean;
	onToggle: () => void;
	onUpdateMilestone: (
		milestoneId: string,
		data: Partial<Pick<Milestone, "title" | "description">>,
	) => Promise<void>;
	onUpdateInitiative: (
		initiativeId: string,
		data: Partial<
			Pick<Initiative, "title" | "status" | "priority" | "progress" | "size">
		>,
	) => Promise<void>;
	onCreateInitiative: () => void;
	onSelectInitiative?: (initiative: Initiative) => void;
	onRequestDeleteMilestone: (id: string, title: string) => void;
	onRequestDeleteInitiative: (id: string, title: string) => void;
	sensors: ReturnType<typeof useSensors>;
	onInitiativeDragEnd: (event: DragEndEvent) => void;
}) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: milestone.id });

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.5 : undefined,
		boxShadow: isDragging ? "0 4px 12px rgba(0, 0, 0, 0.15)" : undefined,
	};

	// Calculate milestone progress from initiatives
	const milestoneProgress = useMemo(() => {
		if (initiatives.length === 0) return 0;
		const total = initiatives.reduce((sum, i) => sum + i.progress, 0);
		return Math.round(total / initiatives.length);
	}, [initiatives]);

	const milestoneSize = useMemo(() => {
		return initiatives
			.filter((i) => i.size != null)
			.reduce((sum, i) => sum + (i.size ?? 0), 0);
	}, [initiatives]);

	const sortedInitiatives = useMemo(
		() => [...initiatives].sort((a, b) => a.sortOrder - b.sortOrder),
		[initiatives],
	);

	return (
		<>
			{/* Milestone Header Row */}
			<TableRow
				ref={setNodeRef}
				style={style}
				className="bg-muted/60 hover:bg-muted/80 font-medium"
				{...attributes}
			>
				<TableCell>
					<div className="flex items-center gap-1.5">
						<button
							type="button"
							className="bg-transparent border-none p-0 cursor-grab text-muted-foreground hover:text-foreground"
							{...listeners}
						>
							<GripVertical className="size-4" />
						</button>
						<button
							type="button"
							className="bg-transparent border-none p-0.5 cursor-pointer hover:text-foreground/80 rounded"
							onClick={onToggle}
						>
							{isCollapsed ? (
								<ChevronRight className="size-4" />
							) : (
								<ChevronDown className="size-4" />
							)}
						</button>
						{hasDeps && (
							<GitBranch className="size-3.5 text-amber-500 shrink-0" />
						)}
						<EditableTextCell
							value={milestone.title}
							onSave={(title) => onUpdateMilestone(milestone.id, { title })}
							className="font-semibold"
						/>
						<Badge variant="secondary" className="text-xs ml-1">
							{initiatives.length}
						</Badge>
					</div>
				</TableCell>
				<TableCell />
				<TableCell />
				<TableCell>
					<div className="flex items-center gap-2">
						<Progress value={milestoneProgress} className="h-1.5 w-16" />
						<span className="text-xs text-muted-foreground">
							{milestoneProgress}%
						</span>
					</div>
				</TableCell>
				<TableCell>
					<span className="text-xs text-muted-foreground">
						{milestoneSize > 0 ? milestoneSize : "—"}
					</span>
				</TableCell>
				<TableCell>
					<div className="flex items-center justify-between gap-1">
						{dependencyNames.length > 0 && (
							<span className="text-xs text-muted-foreground truncate max-w-[160px] inline-block">
								{dependencyNames.join(", ")}
							</span>
						)}
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									variant="ghost"
									size="sm"
									className="h-6 w-6 p-0 ml-auto"
								>
									<MoreHorizontal className="size-3.5" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem
									className="text-destructive focus:text-destructive"
									onClick={() =>
										onRequestDeleteMilestone(milestone.id, milestone.title)
									}
								>
									<Trash2 className="size-3.5 mr-2" />
									Delete
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</TableCell>
			</TableRow>

			{/* Initiative Rows */}
			{!isCollapsed && (
				<DndContext
					sensors={sensors}
					collisionDetection={closestCenter}
					onDragEnd={onInitiativeDragEnd}
				>
					<SortableContext
						items={sortedInitiatives.map((i) => i.id)}
						strategy={verticalListSortingStrategy}
					>
						{sortedInitiatives.map((initiative) => {
							const depNames = getDependencyNames(
								initiative.id,
								"initiative",
								dependencies,
								allMilestones,
								allInitiatives,
							);
							const hasInitDeps = hasDependencies(
								initiative.id,
								"initiative",
								dependencies,
							);

							return (
								<InitiativeRow
									key={initiative.id}
									initiative={initiative}
									dependencyNames={depNames}
									hasDependencies={hasInitDeps}
									onUpdate={onUpdateInitiative}
									onSelect={onSelectInitiative}
									onRequestDelete={onRequestDeleteInitiative}
								/>
							);
						})}
					</SortableContext>
				</DndContext>
			)}

			{/* Add Initiative Button Row */}
			{!isCollapsed && (
				<TableRow className="hover:bg-transparent">
					<TableCell colSpan={6}>
						<button
							type="button"
							className="flex items-center gap-1 ml-7 text-xs text-muted-foreground hover:text-foreground bg-transparent border-none p-0 cursor-pointer"
							onClick={onCreateInitiative}
						>
							<Plus className="size-3" />
							Add initiative
						</button>
					</TableCell>
				</TableRow>
			)}
		</>
	);
}

// =============================================================================
// Sub-component: Initiative Row
// =============================================================================

function InitiativeRow({
	initiative,
	dependencyNames,
	hasDependencies: hasDeps,
	onUpdate,
	onSelect,
	onRequestDelete,
}: {
	initiative: Initiative;
	dependencyNames: string[];
	hasDependencies: boolean;
	onUpdate: (
		initiativeId: string,
		data: Partial<
			Pick<Initiative, "title" | "status" | "priority" | "progress" | "size">
		>,
	) => Promise<void>;
	onSelect?: (initiative: Initiative) => void;
	onRequestDelete: (id: string, title: string) => void;
}) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: initiative.id });

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.5 : undefined,
		boxShadow: isDragging ? "0 4px 12px rgba(0, 0, 0, 0.15)" : undefined,
	};

	return (
		<TableRow
			ref={setNodeRef}
			style={style}
			className="cursor-pointer"
			onClick={() => onSelect?.(initiative)}
			{...attributes}
		>
			<TableCell onClick={(e) => e.stopPropagation()}>
				<div className="flex items-center gap-1.5 pl-3">
					<button
						type="button"
						className="bg-transparent border-none p-0 cursor-grab text-muted-foreground hover:text-foreground"
						onClick={(e) => e.stopPropagation()}
						{...listeners}
					>
						<GripVertical className="size-4" />
					</button>
					{hasDeps && (
						<GitBranch className="size-3.5 text-amber-500 shrink-0" />
					)}
					<EditableTextCell
						value={initiative.title}
						onSave={(title) => onUpdate(initiative.id, { title })}
					/>
				</div>
			</TableCell>
			<TableCell onClick={(e) => e.stopPropagation()}>
				<StatusSelect
					value={initiative.status}
					onSave={(status) => onUpdate(initiative.id, { status })}
				/>
			</TableCell>
			<TableCell onClick={(e) => e.stopPropagation()}>
				<PrioritySelect
					value={initiative.priority}
					onSave={(priority) => onUpdate(initiative.id, { priority })}
				/>
			</TableCell>
			<TableCell>
				<div className="flex items-center gap-2">
					<Progress value={initiative.progress} className="h-1.5 w-16" />
					<span className="text-xs text-muted-foreground">
						{initiative.progress}%
					</span>
				</div>
			</TableCell>
			<TableCell onClick={(e) => e.stopPropagation()}>
				<Select
					value={String(initiative.size ?? "none")}
					onValueChange={(v) =>
						onUpdate(initiative.id, {
							size: v === "none" ? null : (Number(v) as Initiative["size"]),
						})
					}
				>
					<SelectTrigger
						size="sm"
						className="h-7 text-xs border-none shadow-none px-0 gap-1 w-auto"
					>
						<SelectValue placeholder="Unset" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="none">Unset</SelectItem>
						{FIBONACCI_SIZES.map((size) => (
							<SelectItem key={size} value={String(size)}>
								{size}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</TableCell>
			<TableCell onClick={(e) => e.stopPropagation()}>
				<div className="flex items-center justify-between gap-1">
					{dependencyNames.length > 0 && (
						<span className="text-xs text-muted-foreground truncate max-w-[160px] inline-block">
							{dependencyNames.join(", ")}
						</span>
					)}
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" size="sm" className="h-6 w-6 p-0 ml-auto">
								<MoreHorizontal className="size-3.5" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem
								className="text-destructive focus:text-destructive"
								onClick={() => onRequestDelete(initiative.id, initiative.title)}
							>
								<Trash2 className="size-3.5 mr-2" />
								Delete
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</TableCell>
		</TableRow>
	);
}
