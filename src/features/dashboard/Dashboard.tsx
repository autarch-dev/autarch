import { useCallback, useEffect } from "react";
import { Route, Switch, useLocation } from "wouter";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AnalyticsDashboardPage } from "@/features/analytics/components/AnalyticsDashboardPage";
import { CostDashboardPage } from "@/features/costs/components/CostDashboardPage";
import { KnowledgePage } from "@/features/knowledge/components/KnowledgePage";
import {
	type RoadmapPerspective,
	RoadmapViewContainer,
	useRoadmapStore,
} from "@/features/roadmap";
import { ChannelViewContainer } from "./components/ChannelView";
import { CommandPalette } from "./components/CommandPalette";
import { CompletedWorkflowsPage } from "./components/CompletedWorkflows/CompletedWorkflowsPage";
import { ContentHeader } from "./components/ContentHeader";
import { HomePage } from "./components/HomePage";
import { AppSidebar } from "./components/Sidebar";
import {
	CredentialPromptDialogContainer,
	ShellApprovalDialogContainer,
	WorkflowReviewDiffPage,
	WorkflowViewContainer,
} from "./components/WorkflowView";
import { useDiscussionsStore, useWorkflowsStore } from "./store";

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
			setLocation(`/channel/${channel.id}`);
		},
		[setLocation, createChannel],
	);

	const handleCreateWorkflow = useCallback(
		async (prompt: string) => {
			const workflow = await createWorkflow(prompt);
			setLocation(`/workflow/${workflow.id}`);
		},
		[setLocation, createWorkflow],
	);

	const handleCreateRoadmap = useCallback(
		async (title: string, perspective: RoadmapPerspective, prompt?: string) => {
			const roadmap = await createRoadmap(title, perspective, prompt);
			setLocation(`/roadmap/${roadmap.id}`);
		},
		[setLocation, createRoadmap],
	);

	return (
		<SidebarProvider className="h-svh">
			<AppSidebar
				channels={channels}
				workflows={workflows}
				roadmaps={roadmaps}
				onCreateChannel={handleCreateChannel}
				onCreateWorkflow={handleCreateWorkflow}
				onCreateRoadmap={handleCreateRoadmap}
			/>
			<SidebarInset className="flex flex-col overflow-clip">
				<ContentHeader />
				<div className="flex flex-1 flex-col min-h-0">
					<Switch>
						<Route path="/channel/:id">
							{(params) => (
								<ErrorBoundary key={params.id} featureName="Channel">
									<ChannelViewContainer channelId={params.id} />
								</ErrorBoundary>
							)}
						</Route>
						<Route path="/workflow/:id/review/:reviewId/diff">
							{(params) => (
								<ErrorBoundary
									key={`${params.id}-${params.reviewId}`}
									featureName="Workflow Diff"
								>
									<WorkflowReviewDiffPage
										workflowId={params.id}
										reviewId={params.reviewId}
									/>
								</ErrorBoundary>
							)}
						</Route>
						<Route path="/workflow/:id">
							{(params) => (
								<ErrorBoundary key={params.id} featureName="Workflow">
									<WorkflowViewContainer workflowId={params.id} />
								</ErrorBoundary>
							)}
						</Route>
						<Route path="/roadmap/:id">
							{(params) => (
								<ErrorBoundary key={params.id} featureName="Roadmap">
									<RoadmapViewContainer roadmapId={params.id} />
								</ErrorBoundary>
							)}
						</Route>
						<Route path="/completed">
							<ErrorBoundary featureName="Completed Workflows">
								<CompletedWorkflowsPage />
							</ErrorBoundary>
						</Route>
						<Route path="/costs">
							<ErrorBoundary featureName="Costs">
								<CostDashboardPage />
							</ErrorBoundary>
						</Route>
						<Route path="/analytics">
							<ErrorBoundary featureName="Analytics">
								<AnalyticsDashboardPage />
							</ErrorBoundary>
						</Route>
						<Route path="/knowledge">
							<ErrorBoundary featureName="Knowledge">
								<KnowledgePage />
							</ErrorBoundary>
						</Route>
						<Route path="/">
							<HomePage />
						</Route>
					</Switch>
				</div>
			</SidebarInset>

			{/* Command palette (⌘K) */}
			<CommandPalette />

			{/* Global shell approval dialog */}
			<ShellApprovalDialogContainer />

			{/* Global credential prompt dialog */}
			<CredentialPromptDialogContainer />
		</SidebarProvider>
	);
}
