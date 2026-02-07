/**
 * InitiativeDetail - Side panel for viewing and editing initiative details
 *
 * Shows full initiative details including editable title, description (markdown textarea),
 * status/priority dropdowns, progress controls, linked workflow section, and a placeholder
 * Break Down button. Rendered as a Sheet (side panel) when clicking an initiative.
 */

import {
	ExternalLink,
	GitBranch,
	Link2,
	Link2Off,
	Plus,
	Sparkles,
	Trash2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
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
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useWorkflowsStore } from "@/features/dashboard/store/workflowsStore";
import { cn } from "@/lib/utils";
import type {
	Initiative,
	InitiativePriority,
	InitiativeStatus,
} from "@/shared/schemas/roadmap";
import type { WorkflowStatus } from "@/shared/schemas/workflow";
import { ProgressControls } from "./ProgressControls";

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

const FIBONACCI_SIZES = [1, 2, 3, 5, 8, 13, 21] as const;

const STATUS_COLORS: Record<InitiativeStatus, string> = {
	not_started: "text-muted-foreground bg-muted",
	in_progress: "text-blue-700 bg-blue-100 dark:text-blue-400 dark:bg-blue-950",
	completed:
		"text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-950",
	blocked: "text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-950",
};

const WORKFLOW_STATUS_COLORS: Record<WorkflowStatus, string> = {
	backlog: "text-muted-foreground bg-muted",
	scoping:
		"text-purple-700 bg-purple-100 dark:text-purple-400 dark:bg-purple-950",
	researching: "text-blue-700 bg-blue-100 dark:text-blue-400 dark:bg-blue-950",
	planning: "text-cyan-700 bg-cyan-100 dark:text-cyan-400 dark:bg-cyan-950",
	in_progress:
		"text-yellow-700 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-950",
	review:
		"text-orange-700 bg-orange-100 dark:text-orange-400 dark:bg-orange-950",
	done: "text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-950",
};

const WORKFLOW_STATUS_LABELS: Record<WorkflowStatus, string> = {
	backlog: "Backlog",
	scoping: "Scoping",
	researching: "Researching",
	planning: "Planning",
	in_progress: "In Progress",
	review: "Review",
	done: "Done",
};

// =============================================================================
// Props
// =============================================================================

interface InitiativeDetailProps {
	initiative: Initiative | null;
	roadmapId: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onUpdateInitiative: (
		initiativeId: string,
		data: Partial<
			Pick<
				Initiative,
				"title" | "description" | "status" | "priority" | "progress" | "size"
			>
		> & { workflowId?: string | null },
	) => Promise<void>;
	onDeleteInitiative: (initiativeId: string) => Promise<void>;
}

// =============================================================================
// Component
// =============================================================================

export function InitiativeDetail({
	initiative,
	roadmapId: _roadmapId,
	open,
	onOpenChange,
	onUpdateInitiative,
	onDeleteInitiative,
}: InitiativeDetailProps) {
	// Workflow store for linking
	const { workflows, fetchWorkflows, createWorkflow } = useWorkflowsStore();

	const [editTitle, setEditTitle] = useState("");
	const [editDescription, setEditDescription] = useState("");
	const [isEditingTitle, setIsEditingTitle] = useState(false);
	const [isEditingDescription, setIsEditingDescription] = useState(false);
	const [isCreatingWorkflow, setIsCreatingWorkflow] = useState(false);
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);

	// Sync local state when initiative changes
	useEffect(() => {
		if (initiative) {
			setEditTitle(initiative.title);
			setEditDescription(initiative.description ?? "");
			setIsEditingTitle(false);
			setIsEditingDescription(false);
		}
	}, [initiative]);

	// Fetch workflows on open for linking
	useEffect(() => {
		if (open) {
			fetchWorkflows();
		}
	}, [open, fetchWorkflows]);

	// Find linked workflow
	const linkedWorkflow = initiative?.workflowId
		? workflows.find((w) => w.id === initiative.workflowId)
		: undefined;

	// Available workflows for linking (non-archived, not already linked)
	const availableWorkflows = workflows.filter(
		(w) => !w.archived && w.id !== initiative?.workflowId,
	);

	// -------------------------------------------------------------------------
	// Handlers
	// -------------------------------------------------------------------------

	const handleTitleSave = useCallback(async () => {
		if (!initiative) return;
		const trimmed = editTitle.trim();
		if (trimmed && trimmed !== initiative.title) {
			await onUpdateInitiative(initiative.id, { title: trimmed });
		}
		setIsEditingTitle(false);
	}, [initiative, editTitle, onUpdateInitiative]);

	const handleTitleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "Enter") {
				handleTitleSave();
			} else if (e.key === "Escape") {
				setEditTitle(initiative?.title ?? "");
				setIsEditingTitle(false);
			}
		},
		[handleTitleSave, initiative?.title],
	);

	const handleDescriptionSave = useCallback(async () => {
		if (!initiative) return;
		const trimmed = editDescription.trim();
		if (trimmed !== (initiative.description ?? "")) {
			await onUpdateInitiative(initiative.id, {
				description: trimmed || undefined,
			});
		}
		setIsEditingDescription(false);
	}, [initiative, editDescription, onUpdateInitiative]);

	const handleStatusChange = useCallback(
		async (status: InitiativeStatus) => {
			if (!initiative) return;
			await onUpdateInitiative(initiative.id, { status });
		},
		[initiative, onUpdateInitiative],
	);

	const handlePriorityChange = useCallback(
		async (priority: InitiativePriority) => {
			if (!initiative) return;
			await onUpdateInitiative(initiative.id, { priority });
		},
		[initiative, onUpdateInitiative],
	);

	const handleSizeChange = useCallback(
		async (value: string) => {
			if (!initiative) return;
			if (value === "none") {
				await onUpdateInitiative(initiative.id, { size: null });
			} else {
				await onUpdateInitiative(initiative.id, {
					size: Number(value) as Initiative["size"],
				});
			}
		},
		[initiative, onUpdateInitiative],
	);

	const handleLinkWorkflow = useCallback(
		async (workflowId: string) => {
			if (!initiative) return;
			await onUpdateInitiative(initiative.id, { workflowId });
		},
		[initiative, onUpdateInitiative],
	);

	const handleUnlinkWorkflow = useCallback(async () => {
		if (!initiative) return;
		await onUpdateInitiative(initiative.id, {
			workflowId: null,
		});
	}, [initiative, onUpdateInitiative]);

	const handleCreateAndLinkWorkflow = useCallback(async () => {
		if (!initiative) return;
		setIsCreatingWorkflow(true);
		try {
			const workflow = await createWorkflow(initiative.title);
			await handleLinkWorkflow(workflow.id);
		} catch (error) {
			console.error("Failed to create workflow:", error);
		} finally {
			setIsCreatingWorkflow(false);
		}
	}, [initiative, createWorkflow, handleLinkWorkflow]);

	if (!initiative) return null;

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
				<SheetHeader>
					<SheetTitle className="sr-only">Initiative Details</SheetTitle>
					<SheetDescription className="sr-only">
						View and edit initiative details
					</SheetDescription>
				</SheetHeader>

				<div className="space-y-6 px-4 pb-4">
					{/* Title */}
					<div className="space-y-1.5">
						<Label>Title</Label>
						{isEditingTitle ? (
							<Input
								value={editTitle}
								onChange={(e) => setEditTitle(e.target.value)}
								onBlur={handleTitleSave}
								onKeyDown={handleTitleKeyDown}
								autoFocus
							/>
						) : (
							<button
								type="button"
								className="w-full text-left font-semibold text-lg bg-transparent border-none p-0 cursor-pointer hover:text-foreground/80"
								onClick={() => {
									setEditTitle(initiative.title);
									setIsEditingTitle(true);
								}}
							>
								{initiative.title}
							</button>
						)}
					</div>

					{/* Description */}
					<div className="space-y-1.5">
						<Label>Description</Label>
						{isEditingDescription ? (
							<div className="space-y-2">
								<Textarea
									value={editDescription}
									onChange={(e) => setEditDescription(e.target.value)}
									placeholder="Describe this initiative (supports markdown)..."
									className="min-h-[100px]"
									autoFocus
								/>
								<div className="flex gap-2">
									<Button size="sm" onClick={handleDescriptionSave}>
										Save
									</Button>
									<Button
										size="sm"
										variant="outline"
										onClick={() => {
											setEditDescription(initiative.description ?? "");
											setIsEditingDescription(false);
										}}
									>
										Cancel
									</Button>
								</div>
							</div>
						) : (
							<button
								type="button"
								className="w-full text-left text-sm bg-transparent border-none p-0 cursor-pointer hover:text-foreground/80 min-h-[24px]"
								onClick={() => {
									setEditDescription(initiative.description ?? "");
									setIsEditingDescription(true);
								}}
							>
								{initiative.description ? (
									<span className="text-muted-foreground whitespace-pre-wrap">
										{initiative.description}
									</span>
								) : (
									<span className="text-muted-foreground italic">
										Click to add description...
									</span>
								)}
							</button>
						)}
					</div>

					<Separator />

					{/* Status and Priority */}
					<div className="grid grid-cols-2 gap-4">
						<div className="space-y-1.5">
							<Label>Status</Label>
							<Select
								value={initiative.status}
								onValueChange={(v) => handleStatusChange(v as InitiativeStatus)}
							>
								<SelectTrigger className="w-full">
									<SelectValue>
										<Badge
											variant="secondary"
											className={cn(
												"text-xs",
												STATUS_COLORS[initiative.status],
											)}
										>
											{STATUS_OPTIONS.find((o) => o.value === initiative.status)
												?.label ?? initiative.status}
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
						</div>

						<div className="space-y-1.5">
							<Label>Priority</Label>
							<Select
								value={initiative.priority}
								onValueChange={(v) =>
									handlePriorityChange(v as InitiativePriority)
								}
							>
								<SelectTrigger className="w-full">
									<SelectValue>
										{PRIORITY_OPTIONS.find(
											(o) => o.value === initiative.priority,
										)?.label ?? initiative.priority}
									</SelectValue>
								</SelectTrigger>
								<SelectContent>
									{PRIORITY_OPTIONS.map((opt) => (
										<SelectItem key={opt.value} value={opt.value}>
											{opt.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</div>

					{/* Size */}
					<div className="grid grid-cols-2 gap-4">
						<div className="space-y-1.5">
							<Label>Size</Label>
							<Select
								value={String(initiative.size ?? "none")}
								onValueChange={handleSizeChange}
							>
								<SelectTrigger className="w-full">
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
						</div>
					</div>

					<Separator />

					{/* Progress Controls */}
					<ProgressControls
						initiative={initiative}
						linkedWorkflowStatus={linkedWorkflow?.status}
					/>

					<Separator />

					{/* Linked Workflow Section */}
					<div className="space-y-3">
						<Label>Linked Workflow</Label>

						{linkedWorkflow ? (
							<div className="rounded-md border p-3 space-y-2">
								<div className="flex items-center justify-between">
									<a
										href={`/workflow/${linkedWorkflow.id}`}
										className="text-sm font-medium hover:underline flex items-center gap-1.5"
									>
										<GitBranch className="size-3.5" />
										{linkedWorkflow.title}
										<ExternalLink className="size-3" />
									</a>
									<Badge
										variant="secondary"
										className={cn(
											"text-xs",
											WORKFLOW_STATUS_COLORS[linkedWorkflow.status],
										)}
									>
										{WORKFLOW_STATUS_LABELS[linkedWorkflow.status]}
									</Badge>
								</div>
								<Button
									variant="outline"
									size="sm"
									onClick={handleUnlinkWorkflow}
									className="w-full"
								>
									<Link2Off className="size-3.5 mr-1.5" />
									Unlink
								</Button>
							</div>
						) : (
							<div className="rounded-md border border-dashed p-3">
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button variant="outline" size="sm" className="w-full">
											<Link2 className="size-3.5 mr-1.5" />
											Link Workflow
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent
										align="start"
										className="w-[300px] max-h-[300px] overflow-y-auto"
									>
										{availableWorkflows.length > 0 ? (
											<>
												{availableWorkflows.map((w) => (
													<DropdownMenuItem
														key={w.id}
														onClick={() => handleLinkWorkflow(w.id)}
													>
														<div className="flex items-center justify-between w-full">
															<span className="truncate mr-2">{w.title}</span>
															<Badge
																variant="secondary"
																className={cn(
																	"text-xs shrink-0",
																	WORKFLOW_STATUS_COLORS[w.status],
																)}
															>
																{WORKFLOW_STATUS_LABELS[w.status]}
															</Badge>
														</div>
													</DropdownMenuItem>
												))}
												<DropdownMenuSeparator />
											</>
										) : (
											<DropdownMenuItem disabled>
												<span className="text-muted-foreground">
													No workflows available
												</span>
											</DropdownMenuItem>
										)}
										<DropdownMenuItem
											onClick={handleCreateAndLinkWorkflow}
											disabled={isCreatingWorkflow}
										>
											<Plus className="size-3.5 mr-1.5" />
											{isCreatingWorkflow
												? "Creating..."
												: "Create New Workflow"}
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							</div>
						)}
					</div>

					<Separator />

					{/* Break Down Button (placeholder for v1) */}
					<div className="space-y-1.5">
						<Tooltip>
							<TooltipTrigger asChild>
								<span className="inline-block w-full">
									<Button variant="outline" className="w-full" disabled>
										<Sparkles className="size-3.5 mr-1.5" />
										Break Down with AI
									</Button>
								</span>
							</TooltipTrigger>
							<TooltipContent>
								Coming soon — AI-powered decomposition into sub-items
							</TooltipContent>
						</Tooltip>
					</div>

					<Separator />

					{/* Delete Initiative */}
					<div className="space-y-1.5">
						<Button
							variant="destructive"
							className="w-full"
							onClick={() => setIsDeleteDialogOpen(true)}
						>
							<Trash2 className="size-3.5 mr-1.5" />
							Delete Initiative
						</Button>
					</div>
				</div>

				{/* Delete Confirmation Dialog */}
				<Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Delete Initiative</DialogTitle>
							<DialogDescription>
								Delete this initiative? This action cannot be undone.
							</DialogDescription>
						</DialogHeader>
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
									try {
										await onDeleteInitiative(initiative.id);
										setIsDeleteDialogOpen(false);
										onOpenChange(false);
									} catch (error) {
										console.error("Failed to delete initiative:", error);
									} finally {
										setIsDeleting(false);
									}
								}}
							>
								{isDeleting ? "Deleting..." : "Delete"}
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			</SheetContent>
		</Sheet>
	);
}
