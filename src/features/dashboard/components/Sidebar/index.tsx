import {
	Sidebar,
	SidebarContent,
	SidebarSeparator,
} from "@/components/ui/sidebar";
import type { Channel } from "@/shared/schemas/channel";
import type { Workflow } from "@/shared/schemas/workflow";
import { DiscussionsSection } from "./DiscussionsSection";
import { SidebarFooter } from "./SidebarFooter";
import { SidebarHeader } from "./SidebarHeader";
import { WorkflowsSection } from "./WorkflowsSection";

interface AppSidebarProps {
	channels: Channel[];
	workflows: Workflow[];
	onCreateChannel: (name: string, description?: string) => Promise<void>;
	onCreateWorkflow?: (title: string) => Promise<void>;
}

export function AppSidebar({
	channels,
	workflows,
	onCreateChannel,
	onCreateWorkflow,
}: AppSidebarProps) {
	return (
		<Sidebar collapsible="icon">
			<SidebarHeader />

			<SidebarContent className="overflow-x-hidden">
				<DiscussionsSection
					channels={channels}
					onCreateChannel={onCreateChannel}
				/>

				<SidebarSeparator />

				<WorkflowsSection
					workflows={workflows}
					onCreateWorkflow={onCreateWorkflow}
				/>
			</SidebarContent>

			<SidebarFooter />
		</Sidebar>
	);
}
