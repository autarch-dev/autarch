import {
	CheckCircle2,
	ChevronRight,
	Circle,
	Loader2,
	Plus,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import { CreateWorkflowDialog } from "./CreateWorkflowDialog";
import { statusColors } from "./constants";

interface WorkflowsSectionProps {
	workflows: Workflow[];
	onCreateWorkflow?: (title: string) => Promise<void>;
}

export function WorkflowsSection({
	workflows,
	onCreateWorkflow,
}: WorkflowsSectionProps) {
	const [dialogOpen, setDialogOpen] = useState(false);
	const [location] = useLocation();

	const activeWorkflows = useMemo(
		() =>
			workflows
				.filter((w) => w.status !== "done")
				.sort((a, b) =>
					a.title.localeCompare(b.title, undefined, { sensitivity: "base" }),
				),
		[workflows],
	);
	const completedWorkflows = useMemo(
		() =>
			workflows
				.filter((w) => w.status === "done")
				.sort((a, b) => b.updatedAt - a.updatedAt),
		[workflows],
	);
	const displayedCompleted = useMemo(
		() => completedWorkflows.slice(0, 5),
		[completedWorkflows],
	);

	const totalCount = activeWorkflows.length + completedWorkflows.length;

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

			<Collapsible defaultOpen className="group/collapsible">
				<SidebarGroup>
					<SidebarGroupLabel asChild>
						<CollapsibleTrigger>
							<ChevronRight className="size-3.5 shrink-0 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
							<span>Workflows</span>
							{totalCount > 0 && (
								<span className="ml-auto mr-4 text-xs tabular-nums text-sidebar-foreground/50">
									{totalCount}
								</span>
							)}
						</CollapsibleTrigger>
					</SidebarGroupLabel>
					<SidebarGroupAction
						title="New workflow"
						onClick={() => setDialogOpen(true)}
					>
						<Plus className="size-4" />
						<span className="sr-only">New workflow</span>
					</SidebarGroupAction>
					<CollapsibleContent>
						<SidebarGroupContent>
							<SidebarMenu>
								{activeWorkflows.length === 0 &&
								completedWorkflows.length === 0 ? (
									<SidebarMenuItem>
										<div className="px-2 py-1.5 text-sm text-muted-foreground">
											No workflows yet
										</div>
									</SidebarMenuItem>
								) : (
									<>
										{activeWorkflows.map((workflow) => {
											const href = `/workflow/${workflow.id}`;
											const isActive = location === href;

											return (
												<SidebarMenuItem key={workflow.id}>
													<SidebarMenuButton
														asChild
														isActive={isActive}
														tooltip={workflow.title}
														className={cn(
															"flex-1 border-l-2 rounded-l-none",
															isActive
																? "border-l-primary"
																: "border-l-transparent",
														)}
													>
														<Link href={href}>
															{workflow.awaitingApproval ? (
																<Circle
																	className={cn(
																		"size-3 shrink-0",
																		workflow.awaitingApproval && "fill-current",
																		statusColors[workflow.status],
																	)}
																/>
															) : (
																<Loader2
																	className={cn(
																		"h-4 w-4 animate-spin",
																		statusColors[workflow.status],
																	)}
																/>
															)}
															<span className="truncate">{workflow.title}</span>
														</Link>
													</SidebarMenuButton>
												</SidebarMenuItem>
											);
										})}

										{completedWorkflows.length > 0 &&
											activeWorkflows.length > 0 && (
												<div className="my-1">
													<SidebarSeparator />
												</div>
											)}

										{displayedCompleted.map((workflow) => {
											const href = `/workflow/${workflow.id}`;
											const isActive = location === href;
											return (
												<SidebarMenuItem key={workflow.id}>
													<SidebarMenuButton
														asChild
														isActive={isActive}
														tooltip={workflow.title}
														className={cn(
															"flex-1 border-l-2 rounded-l-none",
															isActive
																? "border-l-primary"
																: "border-l-transparent",
														)}
													>
														<Link href={href}>
															<CheckCircle2 className="size-3 shrink-0 text-green-500" />
															<span className="truncate line-through decoration-muted-foreground/50">
																{workflow.title}
															</span>
														</Link>
													</SidebarMenuButton>
												</SidebarMenuItem>
											);
										})}

										{completedWorkflows.length > 5 && (
											<SidebarMenuItem>
												<SidebarMenuButton
													asChild
													className="text-muted-foreground text-xs"
												>
													<Link href="/completed">View all completed</Link>
												</SidebarMenuButton>
											</SidebarMenuItem>
										)}
									</>
								)}
							</SidebarMenu>
						</SidebarGroupContent>
					</CollapsibleContent>
				</SidebarGroup>
			</Collapsible>
		</>
	);
}
