import { useMemo, useState } from "react";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { ChannelView } from "./components/ChannelView";
import { AppSidebar } from "./components/Sidebar";
import { WorkflowView } from "./components/WorkflowView";
import {
	mockChannels,
	mockMessages,
	mockWorkflowMessages,
	mockWorkflows,
} from "./mockData";
import type { ViewType } from "./types";

export function Dashboard() {
	const [selectedView, setSelectedView] = useState<ViewType>("channel");
	const [selectedId, setSelectedId] = useState<string | null>("general");

	const handleSelectChannel = (channelId: string) => {
		setSelectedView("channel");
		setSelectedId(channelId);
	};

	const handleSelectWorkflow = (workflowId: string) => {
		setSelectedView("workflow");
		setSelectedId(workflowId);
	};

	const handleSendMessage = (content: string) => {
		// Mock: In reality, this would send to the backend
		console.log("Sending message:", content);
	};

	const selectedChannel = useMemo(() => {
		if (selectedView !== "channel" || !selectedId) return null;
		return mockChannels.find((c) => c.id === selectedId) ?? null;
	}, [selectedView, selectedId]);

	const selectedWorkflow = useMemo(() => {
		if (selectedView !== "workflow" || !selectedId) return null;
		return mockWorkflows.find((w) => w.id === selectedId) ?? null;
	}, [selectedView, selectedId]);

	const channelMessages = useMemo(() => {
		if (!selectedChannel) return [];
		return mockMessages.filter((m) => m.channelId === selectedChannel.id);
	}, [selectedChannel]);

	const workflowMessages = useMemo(() => {
		if (!selectedWorkflow) return [];
		return mockWorkflowMessages.filter(
			(m) => m.workflowId === selectedWorkflow.id,
		);
	}, [selectedWorkflow]);

	return (
		<SidebarProvider>
			<AppSidebar
				channels={mockChannels}
				workflows={mockWorkflows}
				selectedView={selectedView}
				selectedId={selectedId}
				onSelectChannel={handleSelectChannel}
				onSelectWorkflow={handleSelectWorkflow}
			/>
			<SidebarInset className="flex flex-col h-svh overflow-hidden">
				{selectedView === "channel" && selectedChannel ? (
					<ChannelView
						channel={selectedChannel}
						messages={channelMessages}
						onSendMessage={handleSendMessage}
					/>
				) : selectedView === "workflow" && selectedWorkflow ? (
					<WorkflowView
						workflow={selectedWorkflow}
						messages={workflowMessages}
						onSendMessage={handleSendMessage}
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
