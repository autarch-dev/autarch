/**
 * RoadmapView - Main presentational component for a roadmap
 *
 * Renders the roadmap header (editable title, status badge, actions),
 * tab-based content switching (Timeline/Table), and a progress summary bar.
 * Timeline and Table views are placeholders for now.
 */

import {
	Calendar,
	FileText,
	MoreHorizontal,
	Pencil,
	TableIcon,
	Trash2,
} from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
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
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type {
	Initiative,
	Milestone,
	Roadmap,
	RoadmapDependency,
	RoadmapStatus,
	VisionDocument,
} from "@/shared/schemas/roadmap";
import type { RoadmapConversationState } from "../store/roadmapStore";
import { InitiativeDetail } from "./InitiativeDetail";
import { PlanningConversation } from "./PlanningConversation";
import { TableView } from "./TableView";
import { TimelineView } from "./TimelineView";
import { VisionDocument as VisionDocumentView } from "./VisionDocument";

// =============================================================================
// Status Config
// =============================================================================

const statusConfig: Record<
	RoadmapStatus,
	{ label: string; color: string; bg: string }
> = {
	draft: {
		label: "Draft",
		color: "text-amber-700 dark:text-amber-400",
		bg: "bg-amber-100 dark:bg-amber-950",
	},
	active: {
		label: "Active",
		color: "text-blue-700 dark:text-blue-400",
		bg: "bg-blue-100 dark:bg-blue-950",
	},
	completed: {
		label: "Completed",
		color: "text-green-700 dark:text-green-400",
		bg: "bg-green-100 dark:bg-green-950",
	},
	archived: {
		label: "Archived",
		color: "text-gray-700 dark:text-gray-400",
		bg: "bg-gray-100 dark:bg-gray-950",
	},
};

// =============================================================================
// Props
// =============================================================================

interface RoadmapViewProps {
	roadmap: Roadmap;
	milestones: Milestone[];
	initiatives: Initiative[];
	vision?: VisionDocument;
	dependencies: RoadmapDependency[];
	conversation?: RoadmapConversationState;
	onUpdateTitle: (title: string) => Promise<void>;
	onUpdateVision: (content: string) => Promise<void>;
	onDelete: () => Promise<void>;
	onSendMessage: (content: string) => void;
	onUpdateMilestone: (
		milestoneId: string,
		data: Partial<Pick<Milestone, "title" | "description">>,
	) => Promise<void>;
	onUpdateInitiative: (
		initiativeId: string,
		data: Partial<
			Pick<
				Initiative,
				| "title"
				| "description"
				| "status"
				| "priority"
				| "progress"
				| "progressMode"
			>
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
}

// =============================================================================
// Component
// =============================================================================

export function RoadmapView({
	roadmap,
	milestones,
	initiatives,
	vision,
	dependencies,
	conversation,
	onUpdateTitle,
	onUpdateVision,
	onDelete,
	onSendMessage,
	onUpdateMilestone,
	onUpdateInitiative,
	onCreateMilestone,
	onCreateInitiative,
}: RoadmapViewProps) {
	const [isEditingTitle, setIsEditingTitle] = useState(false);
	const [editTitle, setEditTitle] = useState(roadmap.title);
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const [deleteError, setDeleteError] = useState<string | null>(null);
	const [selectedInitiative, setSelectedInitiative] =
		useState<Initiative | null>(null);
	const [isDetailOpen, setIsDetailOpen] = useState(false);
	const titleInputRef = useRef<HTMLInputElement>(null);

	const status = statusConfig[roadmap.status];

	// Calculate overall progress (average of initiative progress values)
	const overallProgress = useMemo(() => {
		if (initiatives.length === 0) return 0;
		const total = initiatives.reduce((sum, i) => sum + i.progress, 0);
		return Math.round(total / initiatives.length);
	}, [initiatives]);

	// Show planning conversation when roadmap is draft and has a session
	const showPlanningConversation =
		roadmap.status === "draft" && conversation?.sessionId != null;

	const handleSelectInitiative = useCallback((initiative: Initiative) => {
		setSelectedInitiative(initiative);
		setIsDetailOpen(true);
	}, []);

	const handleDetailOpenChange = useCallback((open: boolean) => {
		setIsDetailOpen(open);
		if (!open) {
			setSelectedInitiative(null);
		}
	}, []);

	const handleTitleClick = () => {
		setEditTitle(roadmap.title);
		setIsEditingTitle(true);
		// Focus input on next render
		setTimeout(() => titleInputRef.current?.focus(), 0);
	};

	const handleTitleSubmit = async () => {
		const trimmed = editTitle.trim();
		if (trimmed && trimmed !== roadmap.title) {
			await onUpdateTitle(trimmed);
		}
		setIsEditingTitle(false);
	};

	const handleTitleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			handleTitleSubmit();
		} else if (e.key === "Escape") {
			setEditTitle(roadmap.title);
			setIsEditingTitle(false);
		}
	};

	return (
		<div className="flex flex-col h-full">
			{/* Header */}
			<header className="px-4 py-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
				<div className="flex items-start justify-between">
					<div className="flex-1 min-w-0">
						<div className="flex items-center gap-2 mb-1">
							<SidebarTrigger className="-ml-1" />
							<Separator orientation="vertical" className="h-4" />
							{isEditingTitle ? (
								<Input
									ref={titleInputRef}
									value={editTitle}
									onChange={(e) => setEditTitle(e.target.value)}
									onBlur={handleTitleSubmit}
									onKeyDown={handleTitleKeyDown}
									className="h-7 text-base font-semibold px-1"
								/>
							) : (
								<button
									type="button"
									className="font-semibold truncate cursor-pointer hover:text-foreground/80 text-left bg-transparent border-none p-0 text-base"
									onClick={handleTitleClick}
									title="Click to edit title"
								>
									{roadmap.title}
								</button>
							)}
						</div>
						{roadmap.description && (
							<p className="text-sm text-muted-foreground ml-9">
								{roadmap.description}
							</p>
						)}
					</div>
					<div className="flex items-center gap-2 ml-4">
						<Badge variant="secondary" className={cn(status.bg, status.color)}>
							{status.label}
						</Badge>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="ghost" size="icon-sm">
									<MoreHorizontal className="size-4" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem onClick={handleTitleClick}>
									<Pencil className="size-4 mr-2" />
									Edit Title
								</DropdownMenuItem>
								<DropdownMenuItem
									onClick={() => {
										setDeleteError(null);
										setIsDeleteDialogOpen(true);
									}}
									className="text-destructive focus:text-destructive"
								>
									<Trash2 className="size-4 mr-2" />
									Delete
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</div>

				{/* Progress Summary Bar */}
				{initiatives.length > 0 && (
					<div className="mt-3 ml-9">
						<div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
							<span>
								Overall Progress ({initiatives.length}{" "}
								{initiatives.length === 1 ? "initiative" : "initiatives"})
							</span>
							<span>{overallProgress}%</span>
						</div>
						<div className="h-2 rounded-full bg-muted overflow-hidden">
							<div
								className="h-full rounded-full bg-primary transition-all duration-300"
								style={{ width: `${overallProgress}%` }}
							/>
						</div>
					</div>
				)}
			</header>

			{/* Content */}
			{showPlanningConversation && conversation ? (
				<PlanningConversation
					roadmapId={roadmap.id}
					conversation={conversation}
					onSendMessage={onSendMessage}
				/>
			) : (
				<Tabs defaultValue="timeline" className="flex-1 flex flex-col min-h-0">
					<div className="px-4 pt-3">
						<TabsList>
							<TabsTrigger value="timeline">
								<Calendar className="size-4 mr-1.5" />
								Timeline
							</TabsTrigger>
							<TabsTrigger value="table">
								<TableIcon className="size-4 mr-1.5" />
								Table
							</TabsTrigger>
							<TabsTrigger value="vision">
								<FileText className="size-4 mr-1.5" />
								Vision
							</TabsTrigger>
						</TabsList>
					</div>

					<TabsContent value="timeline" className="flex-1 min-h-0 p-4">
						<TimelineView
							roadmapId={roadmap.id}
							milestones={milestones}
							initiatives={initiatives}
							dependencies={dependencies}
							onSelectInitiative={handleSelectInitiative}
						/>
					</TabsContent>

					<TabsContent value="table" className="flex-1 min-h-0 p-4">
						<TableView
							roadmapId={roadmap.id}
							milestones={milestones}
							initiatives={initiatives}
							dependencies={dependencies}
							onUpdateMilestone={onUpdateMilestone}
							onUpdateInitiative={onUpdateInitiative}
							onCreateMilestone={onCreateMilestone}
							onCreateInitiative={onCreateInitiative}
							onSelectInitiative={handleSelectInitiative}
						/>
					</TabsContent>

					<TabsContent value="vision" className="flex-1 min-h-0 p-4">
						<VisionDocumentView
							vision={vision}
							onUpdateVision={onUpdateVision}
						/>
					</TabsContent>
				</Tabs>
			)}

			{/* Initiative Detail Side Panel */}
			<InitiativeDetail
				initiative={selectedInitiative}
				roadmapId={roadmap.id}
				open={isDetailOpen}
				onOpenChange={handleDetailOpenChange}
				onUpdateInitiative={onUpdateInitiative}
			/>

			{/* Delete Confirmation Dialog */}
			<Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete Roadmap</DialogTitle>
						<DialogDescription>
							Delete this roadmap and all its milestones, initiatives, and
							dependencies? This action cannot be undone.
						</DialogDescription>
					</DialogHeader>
					{deleteError && (
						<p className="text-sm text-destructive">{deleteError}</p>
					)}
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setIsDeleteDialogOpen(false)}
						>
							Cancel
						</Button>
						<Button
							variant="destructive"
							disabled={isDeleting}
							onClick={async () => {
								setIsDeleting(true);
								setDeleteError(null);
								try {
									await onDelete();
									setIsDeleteDialogOpen(false);
								} catch (error) {
									console.error("Failed to delete roadmap:", error);
									setDeleteError(
										error instanceof Error
											? error.message
											: "Failed to delete roadmap",
									);
								} finally {
									setIsDeleting(false);
								}
							}}
						>
							{isDeleting ? "Deleting…" : "Delete"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
