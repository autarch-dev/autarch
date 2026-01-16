import { useCallback, useEffect, useMemo, useState } from "react";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import type { Channel } from "@/shared/schemas/channel";
import { ChannelView } from "./components/ChannelView";
import { AppSidebar } from "./components/Sidebar";
import { WorkflowView } from "./components/WorkflowView";
import { mockWorkflowMessages, mockWorkflows } from "./mockData";
import { useDiscussionsStore } from "./store";
import type { ViewType } from "./types";

export function Dashboard() {
	const [selectedView, setSelectedView] = useState<ViewType>("channel");
	const [selectedId, setSelectedId] = useState<string | null>(null);

	// Discussions store
	const {
		channels,
		channelsLoading,
		conversations,
		fetchChannels,
		createChannel,
		selectChannel,
		fetchHistory,
		sendMessage,
	} = useDiscussionsStore();

	// Fetch channels on mount
	useEffect(() => {
		fetchChannels();
	}, [fetchChannels]);

	// Fetch channel history when selecting a channel
	useEffect(() => {
		if (selectedView === "channel" && selectedId) {
			// Fetch history if we haven't already
			const conversation = conversations.get(selectedId);
			if (!conversation) {
				fetchHistory(selectedId);
			}
		}
	}, [selectedView, selectedId, conversations, fetchHistory]);

	const handleSelectChannel = useCallback(
		(channelId: string) => {
			setSelectedView("channel");
			setSelectedId(channelId);
			selectChannel(channelId);
		},
		[selectChannel],
	);

	const handleSelectWorkflow = useCallback((workflowId: string) => {
		setSelectedView("workflow");
		setSelectedId(workflowId);
	}, []);

	const handleCreateChannel = useCallback(
		async (name: string, description?: string) => {
			const channel = await createChannel(name, description);
			// Auto-select the new channel
			handleSelectChannel(channel.id);
		},
		[createChannel, handleSelectChannel],
	);

	const handleSendChannelMessage = useCallback(
		async (content: string) => {
			if (selectedView === "channel" && selectedId) {
				await sendMessage(selectedId, content);
			}
		},
		[selectedView, selectedId, sendMessage],
	);

	const handleSendWorkflowMessage = useCallback((content: string) => {
		// TODO: Wire up workflow messages to backend
		console.log("Sending workflow message:", content);
	}, []);

	const selectedChannel = useMemo((): Channel | null => {
		if (selectedView !== "channel" || !selectedId) return null;
		return channels.find((c) => c.id === selectedId) ?? null;
	}, [selectedView, selectedId, channels]);

	const selectedWorkflow = useMemo(() => {
		if (selectedView !== "workflow" || !selectedId) return null;
		return mockWorkflows.find((w) => w.id === selectedId) ?? null;
	}, [selectedView, selectedId]);

	// Get conversation state for selected channel
	const selectedConversation = useMemo(() => {
		if (!selectedId) return undefined;
		return conversations.get(selectedId);
	}, [selectedId, conversations]);

	const workflowMessages = useMemo(() => {
		if (!selectedWorkflow) return [];
		return mockWorkflowMessages.filter(
			(m) => m.workflowId === selectedWorkflow.id,
		);
	}, [selectedWorkflow]);

	return (
		<SidebarProvider>
			<AppSidebar
				channels={channels}
				workflows={mockWorkflows}
				selectedView={selectedView}
				selectedId={selectedId}
				onSelectChannel={handleSelectChannel}
				onSelectWorkflow={handleSelectWorkflow}
				onCreateChannel={handleCreateChannel}
			/>
			<SidebarInset className="flex flex-col h-svh overflow-hidden">
				{selectedView === "channel" && selectedChannel ? (
					<ChannelView
						channel={selectedChannel}
						messages={selectedConversation?.messages ?? []}
						streamingMessage={selectedConversation?.streamingMessage}
						isLoading={selectedConversation?.isLoading ?? channelsLoading}
						onSendMessage={handleSendChannelMessage}
					/>
				) : selectedView === "workflow" && selectedWorkflow ? (
					<WorkflowView
						workflow={selectedWorkflow}
						messages={workflowMessages}
						onSendMessage={handleSendWorkflowMessage}
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
