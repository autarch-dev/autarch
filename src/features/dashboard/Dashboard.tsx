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
		pendingScopeCards,
		fetchWorkflows,
		createWorkflow,
		selectWorkflow,
		fetchHistory: fetchWorkflowHistory,
		sendMessage: sendWorkflowMessage,
		approveArtifact,
		requestChanges,
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

	const handleSendWorkflowMessage = useCallback(
		async (content: string) => {
			if (selectedView === "workflow" && selectedId) {
				await sendWorkflowMessage(selectedId, content);
			}
		},
		[selectedView, selectedId, sendWorkflowMessage],
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

	// Get pending scope card for selected workflow
	const selectedPendingScopeCard = useMemo(() => {
		if (selectedView !== "workflow" || !selectedId) return undefined;
		return pendingScopeCards.get(selectedId);
	}, [selectedView, selectedId, pendingScopeCards]);

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
						isLoading={selectedChannelConversation?.isLoading ?? channelsLoading}
						onSendMessage={handleSendChannelMessage}
					/>
				) : selectedView === "workflow" && selectedWorkflow ? (
					<WorkflowView
						workflow={selectedWorkflow}
						messages={selectedWorkflowConversation?.messages ?? []}
						streamingMessage={selectedWorkflowConversation?.streamingMessage}
						isLoading={selectedWorkflowConversation?.isLoading ?? workflowsLoading}
						pendingScopeCard={selectedPendingScopeCard}
						onSendMessage={handleSendWorkflowMessage}
						onApproveScope={handleApproveScope}
						onRequestChanges={handleRequestChanges}
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
