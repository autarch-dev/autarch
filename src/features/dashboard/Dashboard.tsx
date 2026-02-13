import { Rocket } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, Route, Switch, useLocation } from "wouter";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Button } from "@/components/ui/button";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AnalyticsDashboardPage } from "@/features/analytics/components/AnalyticsDashboardPage";
import { CostDashboardPage } from "@/features/costs/components/CostDashboardPage";
import {
	type RoadmapPerspective,
	RoadmapViewContainer,
	useRoadmapStore,
} from "@/features/roadmap";
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
	const { createWorkflow } = useWorkflowsStore();
	const [, setLocation] = useLocation();
	const [isCreating, setIsCreating] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleCreateWorkflow = useCallback(async () => {
		setIsCreating(true);
		setError(null);
		try {
			const wf = await createWorkflow("My first workflow");
			setLocation(`/workflow/${wf.id}`);
		} catch {
			setError("Failed to create workflow. Please try again.");
		} finally {
			setIsCreating(false);
		}
	}, [createWorkflow, setLocation]);

	return (
		<div className="px-4 py-8 text-center">
			<div className="size-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
				<Rocket className="size-6 text-muted-foreground" />
			</div>
			<h4 className="font-medium mb-1">Welcome to your Dashboard</h4>
			<p className="text-sm text-muted-foreground max-w-sm mx-auto">
				Get started by creating your first workflow or opening a channel. Your
				active workflows and channels will appear here.
			</p>
			{error && <p className="mt-2 text-sm text-destructive">{error}</p>}
			<div className="mt-4 flex items-center justify-center gap-2">
				<Button onClick={handleCreateWorkflow} disabled={isCreating}>
					{isCreating ? "Creating…" : "Create your first workflow"}
				</Button>
				<Button variant="outline" asChild>
					<Link to="/completed">View completed</Link>
				</Button>
			</div>
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
		async (title: string, perspective: RoadmapPerspective, prompt?: string) => {
			const roadmap = await createRoadmap(title, perspective, prompt);
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
						{(params) => (
							<ErrorBoundary key={params.id} featureName="Channel">
								<ChannelViewContainer channelId={params.id} />
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
