import {
	Sidebar,
	SidebarContent,
	SidebarSeparator,
} from "@/components/ui/sidebar";
import type { Channel } from "@/shared/schemas/channel";
import type { Workflow } from "@/shared/schemas/workflow";
import type { ViewType } from "../../types";
import { DiscussionsSection } from "./DiscussionsSection";
import { SidebarFooter } from "./SidebarFooter";
import { SidebarHeader } from "./SidebarHeader";
import { WorkflowsSection } from "./WorkflowsSection";

interface AppSidebarProps {
	channels: Channel[];
	workflows: Workflow[];
	selectedView: ViewType;
	selectedId: string | null;
	onSelectChannel: (channelId: string) => void;
	onSelectWorkflow: (workflowId: string) => void;
	onCreateChannel: (name: string, description?: string) => Promise<void>;
	onCreateWorkflow?: (title: string) => Promise<void>;
}

export function AppSidebar({
	channels,
	workflows,
	selectedView,
	selectedId,
	onSelectChannel,
	onSelectWorkflow,
	onCreateChannel,
	onCreateWorkflow,
}: AppSidebarProps) {
	return (
		<Sidebar collapsible="icon">
			<SidebarHeader />

			<SidebarContent className="overflow-x-hidden">
				<DiscussionsSection
					channels={channels}
					selectedView={selectedView}
					selectedId={selectedId}
					onSelectChannel={onSelectChannel}
					onCreateChannel={onCreateChannel}
				/>

				<SidebarSeparator />

				<WorkflowsSection
					workflows={workflows}
					selectedView={selectedView}
					selectedId={selectedId}
					onSelectWorkflow={onSelectWorkflow}
					onCreateWorkflow={onCreateWorkflow}
				/>
			</SidebarContent>

			<SidebarFooter />
		</Sidebar>
	);
}
