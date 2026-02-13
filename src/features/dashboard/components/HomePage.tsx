import {
	ArrowRight,
	CheckCircle2,
	Circle,
	Hash,
	Loader2,
	MapIcon,
	Plus,
	Zap,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
	CreateRoadmapDialog,
	type RoadmapPerspective,
	useRoadmapStore,
} from "@/features/roadmap";
import { cn } from "@/lib/utils";
import type { Roadmap } from "@/shared/schemas/roadmap";
import {
	WORKFLOW_STATUS_COLORS,
	WORKFLOW_STATUS_LABELS,
	type WorkflowStatus,
} from "@/shared/schemas/workflow";
import {
	useDiscussionsStore,
	useProjectStore,
	useWorkflowsStore,
} from "../store";
import { CreateChannelDialog } from "./Sidebar/CreateChannelDialog";
import { CreateWorkflowDialog } from "./Sidebar/CreateWorkflowDialog";
import { statusColors } from "./Sidebar/constants";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getGreeting(): string {
	const hour = new Date().getHours();
	if (hour < 12) return "Good morning";
	if (hour < 17) return "Good afternoon";
	return "Good evening";
}

function timeAgo(timestamp: number): string {
	const seconds = Math.floor((Date.now() - timestamp) / 1000);
	if (seconds < 60) return "just now";
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	return `${days}d ago`;
}

const roadmapStatusColors: Record<string, string> = {
	draft: "text-muted-foreground",
	active: "text-blue-500",
	completed: "text-green-500",
	archived: "text-gray-400",
	error: "text-red-500",
};

// ---------------------------------------------------------------------------
// Stat Card
// ---------------------------------------------------------------------------

function StatCard({
	label,
	value,
	icon: Icon,
}: {
	label: string;
	value: number;
	icon: React.ComponentType<{ className?: string }>;
}) {
	return (
		<div className="rounded-xl border bg-card text-card-foreground shadow-sm p-4">
			<div className="flex items-center justify-between">
				<div>
					<p className="text-2xl font-semibold tabular-nums tracking-tight">
						{value}
					</p>
					<p className="text-xs text-muted-foreground mt-0.5">{label}</p>
				</div>
				<div className="size-9 rounded-lg bg-muted flex items-center justify-center">
					<Icon className="size-4 text-muted-foreground" />
				</div>
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// HomePage
// ---------------------------------------------------------------------------

export function HomePage() {
	const [, setLocation] = useLocation();
	const { project } = useProjectStore();

	// Stores
	const { workflows, createWorkflow } = useWorkflowsStore();
	const { channels, createChannel } = useDiscussionsStore();
	const { roadmaps, createRoadmap } = useRoadmapStore();

	// Dialog states
	const [workflowDialogOpen, setWorkflowDialogOpen] = useState(false);
	const [channelDialogOpen, setChannelDialogOpen] = useState(false);
	const [roadmapDialogOpen, setRoadmapDialogOpen] = useState(false);

	// Derived data
	const activeWorkflows = useMemo(
		() =>
			workflows
				.filter((w) => w.status !== "done" && !w.archived)
				.sort((a, b) => b.updatedAt - a.updatedAt),
		[workflows],
	);
	const completedCount = useMemo(
		() => workflows.filter((w) => w.status === "done").length,
		[workflows],
	);
	const sortedRoadmaps = useMemo(
		() =>
			[...roadmaps]
				.filter((r) => r.status !== "archived")
				.sort((a, b) =>
					a.title.localeCompare(b.title, undefined, { sensitivity: "base" }),
				),
		[roadmaps],
	);
	const sortedChannels = useMemo(
		() =>
			[...channels].sort((a, b) =>
				a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
			),
		[channels],
	);

	// Create handlers
	const handleCreateWorkflow = useCallback(
		async (prompt: string) => {
			const wf = await createWorkflow(prompt);
			setLocation(`/workflow/${wf.id}`);
		},
		[createWorkflow, setLocation],
	);

	const handleCreateChannel = useCallback(
		async (name: string, description?: string) => {
			const ch = await createChannel(name, description);
			setLocation(`/channel/${ch.id}`);
		},
		[createChannel, setLocation],
	);

	const handleCreateRoadmap = useCallback(
		async (title: string, perspective: RoadmapPerspective, prompt?: string) => {
			const rm = await createRoadmap(title, perspective, prompt);
			setLocation(`/roadmap/${rm.id}`);
		},
		[createRoadmap, setLocation],
	);

	return (
		<div className="flex-1 overflow-auto">
			<div className="mx-auto max-w-5xl px-8 py-10 space-y-10">
				{/* Hero: Greeting + Quick Action */}
				<div className="flex items-start justify-between">
					<div>
						<p className="text-sm text-muted-foreground">{getGreeting()}</p>
						<h1 className="text-2xl font-semibold tracking-tight mt-1">
							{project?.name ?? "Your Project"}
						</h1>
					</div>
					<Button onClick={() => setWorkflowDialogOpen(true)}>
						<Plus className="size-4 mr-2" />
						New Workflow
					</Button>
				</div>

				{/* Stats Grid */}
				<div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
					<StatCard
						label="Active Workflows"
						value={activeWorkflows.length}
						icon={Zap}
					/>
					<StatCard
						label="Completed"
						value={completedCount}
						icon={CheckCircle2}
					/>
					<StatCard
						label="Roadmaps"
						value={sortedRoadmaps.length}
						icon={MapIcon}
					/>
					<StatCard
						label="Channels"
						value={sortedChannels.length}
						icon={Hash}
					/>
				</div>

				{/* Active Workflows */}
				{activeWorkflows.length > 0 && (
					<section>
						<div className="flex items-center justify-between mb-3">
							<h2 className="text-sm font-medium text-muted-foreground">
								Active Workflows
							</h2>
							<Button
								variant="ghost"
								size="sm"
								className="text-xs text-muted-foreground"
								asChild
							>
								<Link href="/completed">
									View completed
									<ArrowRight className="size-3 ml-1" />
								</Link>
							</Button>
						</div>
						<Card className="py-0 gap-0 overflow-hidden">
							{activeWorkflows.map((workflow, i) => {
								const status = workflow.status as WorkflowStatus;
								return (
									<Link key={workflow.id} href={`/workflow/${workflow.id}`}>
										<div
											className={cn(
												"flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors cursor-pointer",
												i > 0 && "border-t",
											)}
										>
											{workflow.awaitingApproval ? (
												<Circle
													className={cn(
														"size-3.5 shrink-0 fill-current",
														statusColors[status],
													)}
												/>
											) : (
												<Loader2
													className={cn(
														"size-3.5 shrink-0 animate-spin",
														statusColors[status],
													)}
												/>
											)}
											<div className="flex-1 min-w-0">
												<div className="font-medium text-sm truncate">
													{workflow.title}
												</div>
												<div className="text-xs text-muted-foreground mt-0.5">
													{WORKFLOW_STATUS_LABELS[status]} &middot;{" "}
													{timeAgo(workflow.updatedAt)}
												</div>
											</div>
											{workflow.awaitingApproval && (
												<Badge
													variant="outline"
													className="text-amber-600 border-amber-500/30 dark:text-amber-400 shrink-0"
												>
													Action needed
												</Badge>
											)}
											<span
												className={cn(
													"inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium shrink-0",
													WORKFLOW_STATUS_COLORS[status],
												)}
											>
												{WORKFLOW_STATUS_LABELS[status]}
											</span>
										</div>
									</Link>
								);
							})}
						</Card>
					</section>
				)}

				{/* Two-column: Channels + Roadmaps */}
				<div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
					{/* Channels */}
					<section>
						<div className="flex items-center justify-between mb-3">
							<h2 className="text-sm font-medium text-muted-foreground">
								Discussions
							</h2>
							<Button
								variant="ghost"
								size="icon-sm"
								onClick={() => setChannelDialogOpen(true)}
							>
								<Plus className="size-3.5" />
							</Button>
						</div>
						<Card className="py-0 gap-0 overflow-hidden">
							{sortedChannels.length === 0 ? (
								<div className="px-4 py-8 text-center">
									<Hash className="size-5 text-muted-foreground/40 mx-auto mb-2" />
									<p className="text-sm text-muted-foreground">
										No channels yet
									</p>
									<Button
										variant="link"
										size="sm"
										className="mt-1 text-xs"
										onClick={() => setChannelDialogOpen(true)}
									>
										Create one
									</Button>
								</div>
							) : (
								sortedChannels.map((channel, i) => (
									<Link key={channel.id} href={`/channel/${channel.id}`}>
										<div
											className={cn(
												"flex items-center gap-2.5 px-4 py-2.5 hover:bg-accent/50 transition-colors cursor-pointer text-sm",
												i > 0 && "border-t",
											)}
										>
											<Hash className="size-3.5 text-muted-foreground shrink-0" />
											<span className="truncate">{channel.name}</span>
										</div>
									</Link>
								))
							)}
						</Card>
					</section>

					{/* Roadmaps */}
					<section>
						<div className="flex items-center justify-between mb-3">
							<h2 className="text-sm font-medium text-muted-foreground">
								Roadmaps
							</h2>
							<Button
								variant="ghost"
								size="icon-sm"
								onClick={() => setRoadmapDialogOpen(true)}
							>
								<Plus className="size-3.5" />
							</Button>
						</div>
						<Card className="py-0 gap-0 overflow-hidden">
							{sortedRoadmaps.length === 0 ? (
								<div className="px-4 py-8 text-center">
									<MapIcon className="size-5 text-muted-foreground/40 mx-auto mb-2" />
									<p className="text-sm text-muted-foreground">
										No roadmaps yet
									</p>
									<Button
										variant="link"
										size="sm"
										className="mt-1 text-xs"
										onClick={() => setRoadmapDialogOpen(true)}
									>
										Create one
									</Button>
								</div>
							) : (
								sortedRoadmaps.map((roadmap: Roadmap, i: number) => (
									<Link key={roadmap.id} href={`/roadmap/${roadmap.id}`}>
										<div
											className={cn(
												"flex items-center gap-2.5 px-4 py-2.5 hover:bg-accent/50 transition-colors cursor-pointer text-sm",
												i > 0 && "border-t",
											)}
										>
											<Circle
												className={cn(
													"size-3 shrink-0 fill-current",
													roadmapStatusColors[roadmap.status] ??
														"text-muted-foreground",
												)}
											/>
											<span className="truncate">{roadmap.title}</span>
										</div>
									</Link>
								))
							)}
						</Card>
					</section>
				</div>
			</div>

			{/* Create dialogs */}
			<CreateWorkflowDialog
				open={workflowDialogOpen}
				onOpenChange={setWorkflowDialogOpen}
				onCreate={handleCreateWorkflow}
			/>
			<CreateChannelDialog
				open={channelDialogOpen}
				onOpenChange={setChannelDialogOpen}
				onCreate={handleCreateChannel}
			/>
			<CreateRoadmapDialog
				open={roadmapDialogOpen}
				onOpenChange={setRoadmapDialogOpen}
				onCreate={handleCreateRoadmap}
			/>
		</div>
	);
}
