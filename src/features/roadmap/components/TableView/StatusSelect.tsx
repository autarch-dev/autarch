import {
	ExternalLink,
	GitBranch,
	Link2,
	Link2Off,
	Loader2,
	Plus,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useWorkflowsStore } from "@/features/dashboard/store/workflowsStore";
import { cn } from "@/lib/utils";
import type { Initiative, InitiativeStatus } from "@/shared/schemas/roadmap";
import {
	WORKFLOW_STATUS_COLORS,
	WORKFLOW_STATUS_LABELS,
} from "@/shared/schemas/workflow";
import { LinkWorkflowDialog } from "./LinkWorkflowDialog";

const STATUS_OPTIONS: { value: InitiativeStatus; label: string }[] = [
	{ value: "not_started", label: "Not Started" },
	{ value: "in_progress", label: "In Progress" },
	{ value: "completed", label: "Completed" },
	{ value: "blocked", label: "Blocked" },
];

const STATUS_COLORS: Record<InitiativeStatus, string> = {
	not_started: "text-muted-foreground bg-muted",
	in_progress: "text-blue-700 bg-blue-100 dark:text-blue-400 dark:bg-blue-950",
	completed:
		"text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-950",
	blocked: "text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-950",
};

export function StatusSelect({
	initiative,
	onUpdateInitiative,
	onMenuOpenChange,
}: {
	initiative: {
		id: string;
		title: string;
		description?: string;
		status: InitiativeStatus;
		workflowId?: string;
	};
	onUpdateInitiative: (
		initiativeId: string,
		data: Partial<Pick<Initiative, "status">> & {
			workflowId?: string | null;
		},
	) => Promise<void>;
	onMenuOpenChange?: (open: boolean) => void;
}) {
	const { workflows, fetchWorkflows, createWorkflow } = useWorkflowsStore();
	const [isCreatingWorkflow, setIsCreatingWorkflow] = useState<boolean>(false);
	const [linkDialogOpen, setLinkDialogOpen] = useState<boolean>(false);

	const linkedWorkflow = initiative.workflowId
		? workflows.find((w) => w.id === initiative.workflowId)
		: undefined;

	const availableWorkflows = workflows.filter(
		(w) => !w.archived && w.id !== initiative.workflowId,
	);

	const handleStatusChange = async (status: InitiativeStatus) => {
		try {
			await onUpdateInitiative(initiative.id, { status });
		} catch (error) {
			console.error(error);
		}
	};

	const handleLinkWorkflow = async (workflowId: string) => {
		try {
			await onUpdateInitiative(initiative.id, {
				workflowId,
				...(initiative.status === "not_started"
					? { status: "in_progress" as const }
					: {}),
			});
			setLinkDialogOpen(false);
		} catch (error) {
			console.error(error);
		}
	};

	const handleUnlinkWorkflow = async () => {
		try {
			await onUpdateInitiative(initiative.id, { workflowId: null });
		} catch (error) {
			console.error(error);
		}
	};

	const handleCreateAndLinkWorkflow = async () => {
		setIsCreatingWorkflow(true);
		try {
			const workflow = await createWorkflow(
				`# ${initiative.title}${initiative.description ? `\n\n${initiative.description}` : ""}`,
			);
			await onUpdateInitiative(initiative.id, {
				workflowId: workflow.id,
				...(initiative.status === "not_started"
					? { status: "in_progress" as const }
					: {}),
			});
		} catch (error) {
			console.error(error);
		} finally {
			setIsCreatingWorkflow(false);
		}
	};

	const option = STATUS_OPTIONS.find((o) => o.value === initiative.status);

	return (
		<>
			<div className="relative">
				{isCreatingWorkflow && (
					<div className="absolute inset-0 z-10 flex items-center justify-center rounded-md bg-background/80">
						<Loader2 className="size-4 animate-spin text-muted-foreground" />
					</div>
				)}
				<DropdownMenu
					onOpenChange={(open) => {
						if (open) {
							fetchWorkflows();
						}
						onMenuOpenChange?.(open);
					}}
				>
					<DropdownMenuTrigger asChild>
						<Button
							variant="ghost"
							size="sm"
							onClick={(e) => e.stopPropagation()}
						>
							<Badge
								variant="secondary"
								className={cn("text-xs", STATUS_COLORS[initiative.status])}
							>
								{option?.label ?? initiative.status}
							</Badge>
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start" className="w-[220px]">
						<DropdownMenuLabel>Workflows</DropdownMenuLabel>
						<DropdownMenuGroup>
							{linkedWorkflow ? (
								<>
									<DropdownMenuItem disabled>
										<GitBranch className="size-3.5 mr-2" />
										<span className="truncate mr-2">
											{linkedWorkflow.title}
										</span>
										<Badge
											variant="secondary"
											className={cn(
												"text-xs shrink-0 ml-auto",
												WORKFLOW_STATUS_COLORS[linkedWorkflow.status],
											)}
										>
											{WORKFLOW_STATUS_LABELS[linkedWorkflow.status]}
										</Badge>
									</DropdownMenuItem>
									<DropdownMenuItem asChild>
										<a href={`/workflow/${initiative.workflowId}`}>
											<ExternalLink className="size-3.5 mr-2" />
											View Workflow
										</a>
									</DropdownMenuItem>
									<DropdownMenuItem onClick={handleUnlinkWorkflow}>
										<Link2Off className="size-3.5 mr-2" />
										Unlink Workflow
									</DropdownMenuItem>
								</>
							) : (
								<>
									<DropdownMenuItem
										disabled={isCreatingWorkflow}
										onClick={handleCreateAndLinkWorkflow}
									>
										<Plus className="size-3.5 mr-2" />
										{isCreatingWorkflow ? "Creating..." : "Start New Workflow"}
									</DropdownMenuItem>
									<DropdownMenuItem onClick={() => setLinkDialogOpen(true)}>
										<Link2 className="size-3.5 mr-2" />
										Link to Existing…
									</DropdownMenuItem>
								</>
							)}
						</DropdownMenuGroup>
						<DropdownMenuSeparator />
						<DropdownMenuLabel>Manually Set Status To…</DropdownMenuLabel>
						<DropdownMenuRadioGroup
							value={initiative.status}
							onValueChange={(v) => handleStatusChange(v as InitiativeStatus)}
						>
							{STATUS_OPTIONS.map((opt) => (
								<DropdownMenuRadioItem key={opt.value} value={opt.value}>
									{opt.label}
								</DropdownMenuRadioItem>
							))}
						</DropdownMenuRadioGroup>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
			<LinkWorkflowDialog
				open={linkDialogOpen}
				onOpenChange={setLinkDialogOpen}
				workflows={availableWorkflows}
				onLink={handleLinkWorkflow}
			/>
		</>
	);
}
