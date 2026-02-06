/**
 * TableView - Spreadsheet-style view of milestones and initiatives
 *
 * Groups initiatives under collapsible milestone headers.
 * Supports sorting by column headers, filtering by status/priority/text,
 * and inline editing of cells (click to edit, blur/enter to save).
 */

import {
	ArrowDown,
	ArrowUp,
	ArrowUpDown,
	ChevronDown,
	ChevronRight,
	GitBranch,
	Plus,
	Search,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
		data: Partial<
			Pick<Milestone, "title" | "description" | "startDate" | "endDate">
		>,
	) => Promise<void>;
	onUpdateInitiative: (
		initiativeId: string,
		data: Partial<
			Pick<Initiative, "title" | "status" | "priority" | "progress">
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

// =============================================================================
// Helper: Format date from timestamp
// =============================================================================

function formatDate(timestamp?: number): string {
	if (!timestamp) return "—";
	return new Date(timestamp).toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

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
				"text-left bg-transparent border-none p-0 cursor-pointer hover:text-foreground/80 truncate max-w-[200px]",
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
// Sub-component: Editable Date Cell
// =============================================================================

function EditableDateCell({
	value,
	onSave,
}: {
	value?: number;
	onSave: (value: number | undefined) => void;
}) {
	const [isEditing, setIsEditing] = useState(false);
	const [editValue, setEditValue] = useState(
		value ? new Date(value).toISOString().split("T")[0] : "",
	);

	const handleStartEdit = () => {
		setEditValue(value ? new Date(value).toISOString().split("T")[0] : "");
		setIsEditing(true);
	};

	const handleSave = () => {
		if (editValue) {
			const timestamp = new Date(editValue).getTime();
			if (!Number.isNaN(timestamp) && timestamp !== value) {
				onSave(timestamp);
			}
		} else if (value) {
			onSave(undefined);
		}
		setIsEditing(false);
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			handleSave();
		} else if (e.key === "Escape") {
			setEditValue(value ? new Date(value).toISOString().split("T")[0] : "");
			setIsEditing(false);
		}
	};

	if (isEditing) {
		return (
			<Input
				type="date"
				value={editValue}
				onChange={(e) => setEditValue(e.target.value)}
				onBlur={handleSave}
				onKeyDown={handleKeyDown}
				className="h-7 text-sm w-[140px]"
				autoFocus
			/>
		);
	}

	return (
		<button
			type="button"
			className="text-left bg-transparent border-none p-0 cursor-pointer hover:text-foreground/80 text-sm"
			onClick={handleStartEdit}
			title="Click to edit"
		>
			{formatDate(value)}
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
							<TableHead className="w-[250px]">
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
							<TableHead className="w-[120px]">Start Date</TableHead>
							<TableHead className="w-[120px]">End Date</TableHead>
							<TableHead className="w-[180px]">Dependencies</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{sortedMilestones.length === 0 ? (
							<TableRow>
								<TableCell
									colSpan={7}
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
									/>
								);
							})
						)}
					</TableBody>
				</Table>
			</div>
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
		data: Partial<
			Pick<Milestone, "title" | "description" | "startDate" | "endDate">
		>,
	) => Promise<void>;
	onUpdateInitiative: (
		initiativeId: string,
		data: Partial<
			Pick<Initiative, "title" | "status" | "priority" | "progress">
		>,
	) => Promise<void>;
	onCreateInitiative: () => void;
	onSelectInitiative?: (initiative: Initiative) => void;
}) {
	// Calculate milestone progress from initiatives
	const milestoneProgress = useMemo(() => {
		if (initiatives.length === 0) return 0;
		const total = initiatives.reduce((sum, i) => sum + i.progress, 0);
		return Math.round(total / initiatives.length);
	}, [initiatives]);

	return (
		<>
			{/* Milestone Header Row */}
			<TableRow className="bg-muted/60 hover:bg-muted/80 font-medium">
				<TableCell>
					<div className="flex items-center gap-1.5">
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
					<EditableDateCell
						value={milestone.startDate}
						onSave={(startDate) =>
							onUpdateMilestone(milestone.id, { startDate })
						}
					/>
				</TableCell>
				<TableCell>
					<EditableDateCell
						value={milestone.endDate}
						onSave={(endDate) => onUpdateMilestone(milestone.id, { endDate })}
					/>
				</TableCell>
				<TableCell>
					{dependencyNames.length > 0 && (
						<span className="text-xs text-muted-foreground truncate max-w-[160px] inline-block">
							{dependencyNames.join(", ")}
						</span>
					)}
				</TableCell>
			</TableRow>

			{/* Initiative Rows */}
			{!isCollapsed &&
				initiatives.map((initiative) => {
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
						/>
					);
				})}

			{/* Add Initiative Button Row */}
			{!isCollapsed && (
				<TableRow className="hover:bg-transparent">
					<TableCell colSpan={7}>
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
}: {
	initiative: Initiative;
	dependencyNames: string[];
	hasDependencies: boolean;
	onUpdate: (
		initiativeId: string,
		data: Partial<
			Pick<Initiative, "title" | "status" | "priority" | "progress">
		>,
	) => Promise<void>;
	onSelect?: (initiative: Initiative) => void;
}) {
	return (
		<TableRow className="cursor-pointer" onClick={() => onSelect?.(initiative)}>
			<TableCell onClick={(e) => e.stopPropagation()}>
				<div className="flex items-center gap-1.5 pl-7">
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
			<TableCell className="text-sm text-muted-foreground">—</TableCell>
			<TableCell className="text-sm text-muted-foreground">—</TableCell>
			<TableCell>
				{dependencyNames.length > 0 && (
					<span className="text-xs text-muted-foreground truncate max-w-[160px] inline-block">
						{dependencyNames.join(", ")}
					</span>
				)}
			</TableCell>
		</TableRow>
	);
}
