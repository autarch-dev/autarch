import { useCallback, useEffect, useMemo, useState } from "react";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import type { Channel } from "@/shared/schemas/channel";
import type { Workflow } from "@/shared/schemas/workflow";
import { ChannelView } from "./components/ChannelView";
import { AppSidebar } from "./components/Sidebar";
import { WorkflowView } from "./components/WorkflowView";
import { useDiscussionsStore, useWorkflowsStore } from "./store";
import type { ViewType } from "./types";

export function Dashboard() {
	const [selectedView, setSelectedView] = useState<ViewType>("channel");
	const [selectedId, setSelectedId] = useState<string | null>(null);

	// Discussions store
	const {
		channels,
		channelsLoading,
		conversations: channelConversations,
		fetchChannels,
		createChannel,
		selectChannel,
		fetchHistory: fetchChannelHistory,
		sendMessage: sendChannelMessage,
	} = useDiscussionsStore();

	// Workflows store
	const {
		workflows,
		workflowsLoading,
		conversations: workflowConversations,
		scopeCards,
		researchCards,
		plans,
		reviewCards,
		fetchWorkflows,
		createWorkflow,
		selectWorkflow,
		fetchHistory: fetchWorkflowHistory,
		approveArtifact,
		requestChanges,
		rewindWorkflow,
	} = useWorkflowsStore();

	// Fetch channels and workflows on mount
	useEffect(() => {
		fetchChannels();
		fetchWorkflows();
	}, [fetchChannels, fetchWorkflows]);

	// Fetch channel history when selecting a channel
	useEffect(() => {
		if (selectedView === "channel" && selectedId) {
			// Fetch history if we haven't already
			const conversation = channelConversations.get(selectedId);
			if (!conversation) {
				fetchChannelHistory(selectedId);
			}
		}
	}, [selectedView, selectedId, channelConversations, fetchChannelHistory]);

	// Fetch workflow history when selecting a workflow
	useEffect(() => {
		if (selectedView === "workflow" && selectedId) {
			// Fetch history if we haven't already
			const conversation = workflowConversations.get(selectedId);
			if (!conversation) {
				fetchWorkflowHistory(selectedId);
			}
		}
	}, [selectedView, selectedId, workflowConversations, fetchWorkflowHistory]);

	const handleSelectChannel = useCallback(
		(channelId: string) => {
			setSelectedView("channel");
			setSelectedId(channelId);
			selectChannel(channelId);
		},
		[selectChannel],
	);

	const handleSelectWorkflow = useCallback(
		(workflowId: string) => {
			setSelectedView("workflow");
			setSelectedId(workflowId);
			selectWorkflow(workflowId);
		},
		[selectWorkflow],
	);

	const handleCreateChannel = useCallback(
		async (name: string, description?: string) => {
			const channel = await createChannel(name, description);
			// Auto-select the new channel
			handleSelectChannel(channel.id);
		},
		[createChannel, handleSelectChannel],
	);

	const handleCreateWorkflow = useCallback(
		async (title: string) => {
			const workflow = await createWorkflow(title);
			// Auto-select the new workflow
			handleSelectWorkflow(workflow.id);
		},
		[createWorkflow, handleSelectWorkflow],
	);

	const handleSendChannelMessage = useCallback(
		async (content: string) => {
			if (selectedView === "channel" && selectedId) {
				await sendChannelMessage(selectedId, content);
			}
		},
		[selectedView, selectedId, sendChannelMessage],
	);

	const handleApproveScope = useCallback(async () => {
		if (selectedId) {
			await approveArtifact(selectedId);
		}
	}, [selectedId, approveArtifact]);

	const handleRequestChanges = useCallback(
		async (feedback: string) => {
			if (selectedId) {
				await requestChanges(selectedId, feedback);
			}
		},
		[selectedId, requestChanges],
	);

	const handleRewindWorkflow = useCallback(async () => {
		if (selectedId) {
			await rewindWorkflow(selectedId);
		}
	}, [selectedId, rewindWorkflow]);

	const selectedChannel = useMemo((): Channel | null => {
		if (selectedView !== "channel" || !selectedId) return null;
		return channels.find((c) => c.id === selectedId) ?? null;
	}, [selectedView, selectedId, channels]);

	const selectedWorkflow = useMemo((): Workflow | null => {
		if (selectedView !== "workflow" || !selectedId) return null;
		return workflows.find((w) => w.id === selectedId) ?? null;
	}, [selectedView, selectedId, workflows]);

	// Get conversation state for selected channel
	const selectedChannelConversation = useMemo(() => {
		if (selectedView !== "channel" || !selectedId) return undefined;
		return channelConversations.get(selectedId);
	}, [selectedView, selectedId, channelConversations]);

	// Get conversation state for selected workflow
	const selectedWorkflowConversation = useMemo(() => {
		if (selectedView !== "workflow" || !selectedId) return undefined;
		return workflowConversations.get(selectedId);
	}, [selectedView, selectedId, workflowConversations]);

	// Get scope cards for selected workflow
	const selectedScopeCards = useMemo(() => {
		if (selectedView !== "workflow" || !selectedId) return [];
		return scopeCards.get(selectedId) ?? [];
	}, [selectedView, selectedId, scopeCards]);

	// Get research cards for selected workflow
	const selectedResearchCards = useMemo(() => {
		if (selectedView !== "workflow" || !selectedId) return [];
		return researchCards.get(selectedId) ?? [];
	}, [selectedView, selectedId, researchCards]);

	// Get plans for selected workflow
	const selectedPlans = useMemo(() => {
		if (selectedView !== "workflow" || !selectedId) return [];
		return plans.get(selectedId) ?? [];
	}, [selectedView, selectedId, plans]);

	// Get review cards for selected workflow
	const selectedReviewCards = useMemo(() => {
		if (selectedView !== "workflow" || !selectedId) return [];
		return reviewCards.get(selectedId) ?? [];
	}, [selectedView, selectedId, reviewCards]);

	return (
		<SidebarProvider>
			<AppSidebar
				channels={channels}
				workflows={workflows}
				selectedView={selectedView}
				selectedId={selectedId}
				onSelectChannel={handleSelectChannel}
				onSelectWorkflow={handleSelectWorkflow}
				onCreateChannel={handleCreateChannel}
				onCreateWorkflow={handleCreateWorkflow}
			/>
			<SidebarInset className="flex flex-col h-svh overflow-hidden">
				{selectedView === "channel" && selectedChannel ? (
					<ChannelView
						channel={selectedChannel}
						messages={selectedChannelConversation?.messages ?? []}
						streamingMessage={selectedChannelConversation?.streamingMessage}
						isLoading={
							selectedChannelConversation?.isLoading ?? channelsLoading
						}
						onSendMessage={handleSendChannelMessage}
					/>
				) : selectedView === "workflow" && selectedWorkflow ? (
					<WorkflowView
						workflow={selectedWorkflow}
						messages={selectedWorkflowConversation?.messages ?? []}
						streamingMessage={selectedWorkflowConversation?.streamingMessage}
						isLoading={
							selectedWorkflowConversation?.isLoading ?? workflowsLoading
						}
						scopeCards={selectedScopeCards}
						researchCards={selectedResearchCards}
						plans={selectedPlans}
						reviewCards={selectedReviewCards}
						onApprove={handleApproveScope}
						onRequestChanges={handleRequestChanges}
						onRewind={handleRewindWorkflow}
					/>
				) : (
					<div className="flex items-center justify-center h-full">
						<p className="text-muted-foreground">
							Select a channel or workflow to get started
						</p>
					</div>
				)}
			</SidebarInset>
		</SidebarProvider>
	);
}
