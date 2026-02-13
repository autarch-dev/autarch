import {
	ChevronDown,
	ChevronRight,
	MoreHorizontal,
	Plus,
	Trash2,
} from "lucide-react";
import { memo, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { TableCell, TableRow } from "@/components/ui/table";
import type {
	Initiative,
	Milestone,
	RoadmapDependency,
} from "@/shared/schemas/roadmap";
import { EditableTextCell } from "./EditableTextCell";
import { InitiativeRow } from "./InitiativeRow";

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

export const MilestoneGroup = memo(
	({
		milestone,
		initiatives,
		dependencies,
		allMilestones,
		allInitiatives,
		dependencyNames,
		isCollapsed,
		onToggle,
		onUpdateMilestone,
		onUpdateInitiative,
		onCreateInitiative,
		onSelectInitiative,
		onRequestDeleteMilestone,
		onRequestDeleteInitiative,
		newlyCreatedInitiativeId,
		onTitleSaved,
		onTitleCancelled,
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
			> & { workflowId?: string | null },
		) => Promise<void>;
		onCreateInitiative: () => void;
		onSelectInitiative?: (initiative: Initiative) => void;
		onRequestDeleteMilestone: (id: string, title: string) => void;
		onRequestDeleteInitiative: (id: string, title: string) => void;
		newlyCreatedInitiativeId?: string | null;
		onTitleSaved?: (initiative: Initiative) => void;
		onTitleCancelled?: (initiativeId: string) => void;
	}) => {
		// Calculate milestone progress from initiatives
		const milestoneProgress = useMemo(() => {
			if (initiatives.length === 0) return 0;
			const completed = initiatives.filter(
				(i) => i.status === "completed",
			).length;
			return Math.round((completed / initiatives.length) * 100);
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
					<TableCell>
						<div className="flex items-center gap-2">
							<Progress value={milestoneProgress} className="h-1.5 w-16" />
							<span className="text-xs text-muted-foreground">
								{milestoneProgress}%
							</span>
						</div>
					</TableCell>
					<TableCell />
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
				{!isCollapsed
					? sortedInitiatives.map((initiative) => {
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
									isNewlyCreated={initiative.id === newlyCreatedInitiativeId}
									onTitleSaved={onTitleSaved}
									onTitleCancelled={onTitleCancelled}
								/>
							);
						})
					: null}

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
	},
);
