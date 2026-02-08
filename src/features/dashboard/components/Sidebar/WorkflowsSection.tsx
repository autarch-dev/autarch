import { CheckCircle2, Circle, Loader2, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Progress } from "@/components/ui/progress";
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
				.sort((a, b) =>
					a.title.localeCompare(b.title, undefined, { sensitivity: "base" }),
				),
		[workflows],
	);

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
											isActive ? "border-l-primary" : "border-l-transparent",
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
												<Loader2 className={cn("h-4 w-4 animate-spin", statusColors[workflow.status])} />
											)}
											<span className="truncate">{workflow.title}</span>
										</Link>
									</SidebarMenuButton>
								</SidebarMenuItem>
							);
						})}
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
								{completedWorkflows.map((workflow) => {
									const href = `/workflow/${workflow.id}`;
									const isActive = location === `/dashboard${href}`;
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
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				</>
			)}
		</>
	);
}
