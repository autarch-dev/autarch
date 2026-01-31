import { MoreHorizontal } from "lucide-react";
import { useState } from "react";
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
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import type { Workflow, WorkflowStatus } from "@/shared/schemas/workflow";
import { useWorkflowsStore } from "../../store/workflowsStore";
import { statusConfig } from "./config";
import { PhaseIndicator } from "./PhaseIndicator";

interface WorkflowHeaderProps {
	workflow: Workflow;
	totalCost: number;
	onArchived?: () => void;
	viewedStage?: WorkflowStatus;
	onStageClick?: (stage: WorkflowStatus) => void;
}

export function WorkflowHeader({
	workflow,
	totalCost,
	onArchived,
	viewedStage,
	onStageClick,
}: WorkflowHeaderProps) {
	const [isArchiveDialogOpen, setIsArchiveDialogOpen] =
		useState<boolean>(false);
	const archiveWorkflow = useWorkflowsStore((state) => state.archiveWorkflow);
	const status = statusConfig[workflow.status];
	const StatusIcon = status.icon;

	return (
		<>
			<header className="px-4 py-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
				<div className="flex items-start justify-between mb-3">
					<div className="flex-1 min-w-0">
						<div className="flex items-center gap-2 mb-1">
							<SidebarTrigger className="-ml-1" />
							<Separator orientation="vertical" className="h-4" />
							<StatusIcon className={cn("size-4", status.color)} />
							<h2 className="font-semibold truncate">{workflow.title}</h2>
						</div>
						{workflow.description && (
							<p className="text-sm text-muted-foreground">
								{workflow.description}
							</p>
						)}
					</div>
					<div className="flex items-center gap-2 ml-4">
						<Badge variant="secondary" className={cn(status.bg, status.color)}>
							{status.label}
						</Badge>
						<Badge variant="secondary" className="bg-muted">
							Cost: ${totalCost.toFixed(2)}
						</Badge>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="ghost" size="icon-sm">
									<MoreHorizontal className="size-4" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem onClick={() => setIsArchiveDialogOpen(true)}>
									Archive
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</div>
				{/* Phase Progress */}
				{workflow.status !== "backlog" && (
					<PhaseIndicator
						currentStatus={workflow.status}
						skippedStages={workflow.skippedStages}
						viewedStage={viewedStage}
						onStageClick={onStageClick}
					/>
				)}
			</header>

			<Dialog open={isArchiveDialogOpen} onOpenChange={setIsArchiveDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Archive Workflow</DialogTitle>
						<DialogDescription>
							Archive this workflow? It will be hidden from the workflow list.
							This action cannot be undone.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setIsArchiveDialogOpen(false)}
						>
							Cancel
						</Button>
						<Button
							onClick={() => {
								archiveWorkflow(workflow.id)
									.then(() => {
										onArchived?.();
									})
									.catch((error) => {
										console.error("Failed to archive workflow:", error);
									});
								setIsArchiveDialogOpen(false);
							}}
						>
							Archive
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
