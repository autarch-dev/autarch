import {
	CheckCircle2,
	ChevronDown,
	Circle,
	Hash,
	Plus,
	Search,
	Settings,
	Sparkles,
} from "lucide-react";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupAction,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuBadge,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarSeparator,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import type { Channel, ViewType, Workflow as WorkflowType } from "../types";

interface AppSidebarProps {
	channels: Channel[];
	workflows: WorkflowType[];
	selectedView: ViewType;
	selectedId: string | null;
	onSelectChannel: (channelId: string) => void;
	onSelectWorkflow: (workflowId: string) => void;
}

const statusColors = {
	backlog: "text-muted-foreground",
	scoping: "text-purple-500",
	researching: "text-blue-500",
	planning: "text-cyan-500",
	in_progress: "text-yellow-500",
	review: "text-orange-500",
	done: "text-green-500",
} as const;

const priorityBorders = {
	low: "",
	medium: "border-l-2 border-l-blue-500 rounded-l-none",
	high: "border-l-2 border-l-orange-500 rounded-l-none",
	urgent: "border-l-2 border-l-red-500 rounded-l-none",
} as const;

export function AppSidebar({
	channels,
	workflows,
	selectedView,
	selectedId,
	onSelectChannel,
	onSelectWorkflow,
}: AppSidebarProps) {
	const activeWorkflows = workflows.filter((w) => w.status !== "done");
	const completedWorkflows = workflows.filter((w) => w.status === "done");

	return (
		<Sidebar collapsible="icon">
			{/* Header */}
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton size="lg" tooltip="Project">
							<div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
								<Sparkles className="size-4" />
							</div>
							<div className="grid flex-1 text-left text-sm leading-tight">
								<span className="truncate font-semibold">autarch-cli</span>
								<span className="truncate text-xs text-muted-foreground">
									~/Repos/autarch-cli
								</span>
							</div>
							<ChevronDown className="ml-auto size-4" />
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>

				{/* Search */}
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton tooltip="Search">
							<Search className="size-4 shrink-0" />
							<span className="truncate">Search...</span>
							<kbd className="ml-auto text-[10px] bg-muted px-1.5 py-0.5 rounded pointer-events-none shrink-0">
								⌘K
							</kbd>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>

			<SidebarContent className="overflow-x-hidden">
				{/* Discussions Section */}
				<SidebarGroup>
					<SidebarGroupLabel>Discussions</SidebarGroupLabel>
					<SidebarGroupAction title="New channel">
						<Plus className="size-4" />
						<span className="sr-only">New channel</span>
					</SidebarGroupAction>
					<SidebarGroupContent>
						<SidebarMenu>
							{channels.map((channel) => (
								<SidebarMenuItem key={channel.id}>
									<SidebarMenuButton
										onClick={() => onSelectChannel(channel.id)}
										isActive={
											selectedView === "channel" && selectedId === channel.id
										}
										tooltip={`#${channel.name}`}
									>
										<Hash className="size-4" />
										<span>{channel.name}</span>
									</SidebarMenuButton>
									{channel.unreadCount && channel.unreadCount > 0 ? (
										<SidebarMenuBadge>{channel.unreadCount}</SidebarMenuBadge>
									) : null}
								</SidebarMenuItem>
							))}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>

				<SidebarSeparator />

				{/* Workflows Section */}
				<SidebarGroup>
					<SidebarGroupLabel>Workflows</SidebarGroupLabel>
					<SidebarGroupAction title="New workflow">
						<Plus className="size-4" />
						<span className="sr-only">New workflow</span>
					</SidebarGroupAction>
					<SidebarGroupContent>
						<SidebarMenu>
							{activeWorkflows.map((workflow) => (
								<SidebarMenuItem key={workflow.id}>
									<SidebarMenuButton
										onClick={() => onSelectWorkflow(workflow.id)}
										isActive={
											selectedView === "workflow" && selectedId === workflow.id
										}
										tooltip={workflow.title}
										className={priorityBorders[workflow.priority]}
									>
										<Circle
											className={cn(
												"size-3 shrink-0 fill-current",
												statusColors[workflow.status],
											)}
										/>
										<span className="truncate">{workflow.title}</span>
									</SidebarMenuButton>
								</SidebarMenuItem>
							))}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>

				{completedWorkflows.length > 0 && (
					<>
						<SidebarSeparator />

						{/* Completed Workflows */}
						<SidebarGroup>
							<SidebarGroupLabel>Completed</SidebarGroupLabel>
							<SidebarGroupContent>
								<SidebarMenu>
									{completedWorkflows.map((workflow) => (
										<SidebarMenuItem key={workflow.id}>
											<SidebarMenuButton
												onClick={() => onSelectWorkflow(workflow.id)}
												isActive={
													selectedView === "workflow" &&
													selectedId === workflow.id
												}
												tooltip={workflow.title}
											>
												<CheckCircle2 className="size-3 shrink-0 text-green-500" />
												<span className="truncate line-through decoration-muted-foreground/50">
													{workflow.title}
												</span>
											</SidebarMenuButton>
										</SidebarMenuItem>
									))}
								</SidebarMenu>
							</SidebarGroupContent>
						</SidebarGroup>
					</>
				)}
			</SidebarContent>

			{/* Footer */}
			<SidebarFooter>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton tooltip="Settings">
							<Settings className="size-4" />
							<span>Settings</span>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>
		</Sidebar>
	);
}
