import { CheckCircle2, Circle, MoreHorizontal, Plus } from "lucide-react";
import { useState } from "react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	SidebarGroup,
	SidebarGroupAction,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarSeparator,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import type { Workflow } from "@/shared/schemas/workflow";
import type { ViewType } from "../../types";
import { CreateWorkflowDialog } from "./CreateWorkflowDialog";
import { priorityBorders, statusColors } from "./constants";

interface WorkflowsSectionProps {
	workflows: Workflow[];
	selectedView: ViewType;
	selectedId: string | null;
	onSelectWorkflow: (workflowId: string) => void;
	onCreateWorkflow?: (title: string) => Promise<void>;
}

export function WorkflowsSection({
	workflows,
	selectedView,
	selectedId,
	onSelectWorkflow,
	onCreateWorkflow,
}: WorkflowsSectionProps) {
	const [dialogOpen, setDialogOpen] = useState(false);
	const [_archiveDialogWorkflowId, setArchiveDialogWorkflowId] = useState<
		string | null
	>(null);
	const activeWorkflows = workflows.filter((w) => w.status !== "done");
	const completedWorkflows = workflows.filter((w) => w.status === "done");

	const handleCreate = async (prompt: string) => {
		await onCreateWorkflow?.(prompt);
	};

	return (
		<>
			<CreateWorkflowDialog
				open={dialogOpen}
				onOpenChange={setDialogOpen}
				onCreate={handleCreate}
			/>

			<SidebarGroup>
				<SidebarGroupLabel>Workflows</SidebarGroupLabel>
				<SidebarGroupAction
					title="New workflow"
					onClick={() => setDialogOpen(true)}
				>
					<Plus className="size-4" />
					<span className="sr-only">New workflow</span>
				</SidebarGroupAction>
				<SidebarGroupContent>
					<SidebarMenu>
						{activeWorkflows.map((workflow) => (
							<SidebarMenuItem key={workflow.id}>
								<div className="flex items-center w-full group">
									<SidebarMenuButton
										onClick={() => onSelectWorkflow(workflow.id)}
										isActive={
											selectedView === "workflow" && selectedId === workflow.id
										}
										tooltip={workflow.title}
										className={cn("flex-1", priorityBorders[workflow.priority])}
									>
										<Circle
											className={cn(
												"size-3 shrink-0 fill-current",
												statusColors[workflow.status],
											)}
										/>
										<span className="truncate">{workflow.title}</span>
									</SidebarMenuButton>
									<DropdownMenu>
										<DropdownMenuTrigger asChild>
											<button
												type="button"
												className="opacity-0 group-hover:opacity-100 p-1 hover:bg-accent rounded"
											>
												<MoreHorizontal className="size-4" />
											</button>
										</DropdownMenuTrigger>
										<DropdownMenuContent align="end" side="right">
											<DropdownMenuItem
												onClick={() => setArchiveDialogWorkflowId(workflow.id)}
											>
												Archive
											</DropdownMenuItem>
										</DropdownMenuContent>
									</DropdownMenu>
								</div>
							</SidebarMenuItem>
						))}
					</SidebarMenu>
				</SidebarGroupContent>
			</SidebarGroup>

			{completedWorkflows.length > 0 && (
				<>
					<SidebarSeparator />

					<SidebarGroup>
						<SidebarGroupLabel>Completed</SidebarGroupLabel>
						<SidebarGroupContent>
							<SidebarMenu>
								{completedWorkflows.map((workflow) => (
									<SidebarMenuItem key={workflow.id}>
										<div className="flex items-center w-full group">
											<SidebarMenuButton
												onClick={() => onSelectWorkflow(workflow.id)}
												isActive={
													selectedView === "workflow" &&
													selectedId === workflow.id
												}
												tooltip={workflow.title}
												className="flex-1"
											>
												<CheckCircle2 className="size-3 shrink-0 text-green-500" />
												<span className="truncate line-through decoration-muted-foreground/50">
													{workflow.title}
												</span>
											</SidebarMenuButton>
											<DropdownMenu>
												<DropdownMenuTrigger asChild>
													<button
														type="button"
														className="opacity-0 group-hover:opacity-100 p-1 hover:bg-accent rounded"
													>
														<MoreHorizontal className="size-4" />
													</button>
												</DropdownMenuTrigger>
												<DropdownMenuContent align="end" side="right">
													<DropdownMenuItem
														onClick={() =>
															setArchiveDialogWorkflowId(workflow.id)
														}
													>
														Archive
													</DropdownMenuItem>
												</DropdownMenuContent>
											</DropdownMenu>
										</div>
									</SidebarMenuItem>
								))}
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				</>
			)}
		</>
	);
}
