import { useCallback, useEffect } from "react";
import { Route, Switch, useLocation } from "wouter";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AnalyticsDashboardPage } from "@/features/analytics/components/AnalyticsDashboardPage";
import { CostDashboardPage } from "@/features/costs/components/CostDashboardPage";
import { RoadmapViewContainer, useRoadmapStore } from "@/features/roadmap";
import { ChannelViewContainer } from "./components/ChannelView";
import { CompletedWorkflowsPage } from "./components/CompletedWorkflows/CompletedWorkflowsPage";
import { AppSidebar } from "./components/Sidebar";
import {
	CredentialPromptDialogContainer,
	ShellApprovalDialogContainer,
	WorkflowViewContainer,
} from "./components/WorkflowView";
import { useDiscussionsStore, useWorkflowsStore } from "./store";

/** Empty state shown when no channel or workflow is selected */
function DashboardEmptyState() {
	return (
		<div className="flex items-center justify-center h-full">
			<p className="text-muted-foreground">
				Select a channel or workflow to get started
			</p>
		</div>
	);
}

export function Dashboard() {
	const [, setLocation] = useLocation();

	// Discussions store
	const { channels, fetchChannels, createChannel } = useDiscussionsStore();

	// Workflows store
	const { workflows, fetchWorkflows, createWorkflow } = useWorkflowsStore();

	// Roadmaps store
	const { roadmaps, fetchRoadmaps, createRoadmap } = useRoadmapStore();

	// Fetch channels, workflows, and roadmaps on mount
	useEffect(() => {
		fetchChannels();
		fetchWorkflows();
		fetchRoadmaps();
	}, [fetchChannels, fetchWorkflows, fetchRoadmaps]);

	const handleCreateChannel = useCallback(
		async (name: string, description?: string) => {
			const channel = await createChannel(name, description);
			// Navigate to the new channel
			setLocation(`/channel/${channel.id}`);
		},
		[setLocation, createChannel],
	);

	const handleCreateWorkflow = useCallback(
		async (prompt: string) => {
			const workflow = await createWorkflow(prompt);
			// Navigate to the new workflow
			setLocation(`/workflow/${workflow.id}`);
		},
		[setLocation, createWorkflow],
	);

	const handleCreateRoadmap = useCallback(
		async (title: string, mode: "ai" | "blank", prompt?: string) => {
			const roadmap = await createRoadmap(title, mode, prompt);
			// Navigate to the new roadmap
			setLocation(`/roadmap/${roadmap.id}`);
		},
		[setLocation, createRoadmap],
	);

	return (
		<SidebarProvider>
			<AppSidebar
				channels={channels}
				workflows={workflows}
				roadmaps={roadmaps}
				onCreateChannel={handleCreateChannel}
				onCreateWorkflow={handleCreateWorkflow}
				onCreateRoadmap={handleCreateRoadmap}
			/>
			<SidebarInset className="flex flex-col h-svh overflow-clip">
				<Switch>
					<Route path="/channel/:id">
						{(params) => <ChannelViewContainer channelId={params.id} />}
					</Route>
					<Route path="/workflow/:id">
						{(params) => <WorkflowViewContainer workflowId={params.id} />}
					</Route>
					<Route path="/roadmap/:id">
						{(params) => <RoadmapViewContainer roadmapId={params.id} />}
					</Route>
					<Route path="/completed">
						<CompletedWorkflowsPage />
					</Route>
					<Route path="/costs">
						<CostDashboardPage />
					</Route>
					<Route path="/analytics">
						<AnalyticsDashboardPage />
					</Route>
					<Route path="/">
						<DashboardEmptyState />
					</Route>
				</Switch>
			</SidebarInset>

			{/* Global shell approval dialog - renders when there are pending approvals */}
			<ShellApprovalDialogContainer />

			{/* Global credential prompt dialog - renders when git needs credentials */}
			<CredentialPromptDialogContainer />
		</SidebarProvider>
	);
}
