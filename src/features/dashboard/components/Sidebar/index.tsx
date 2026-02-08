import {
	Sidebar,
	SidebarContent,
	SidebarSeparator,
} from "@/components/ui/sidebar";
import type { Channel } from "@/shared/schemas/channel";
import type { Roadmap } from "@/shared/schemas/roadmap";
import type { Workflow } from "@/shared/schemas/workflow";
import { DiscussionsSection } from "./DiscussionsSection";
import { RoadmapsSection } from "./RoadmapsSection";
import { SidebarFooter } from "./SidebarFooter";
import { SidebarHeader } from "./SidebarHeader";
import { WorkflowsSection } from "./WorkflowsSection";

interface AppSidebarProps {
	channels: Channel[];
	workflows: Workflow[];
	roadmaps: Roadmap[];
	onCreateChannel: (name: string, description?: string) => Promise<void>;
	onCreateWorkflow?: (title: string) => Promise<void>;
	onCreateRoadmap: (
		title: string,
		mode: "ai" | "blank",
		prompt?: string,
	) => Promise<void>;
}

export function AppSidebar({
	channels,
	workflows,
	roadmaps,
	onCreateChannel,
	onCreateWorkflow,
	onCreateRoadmap,
}: AppSidebarProps) {
	return (
		<Sidebar collapsible="icon">
			<SidebarHeader />

			<SidebarContent className="overflow-x-hidden">
				<RoadmapsSection
					roadmaps={roadmaps}
					onCreateRoadmap={onCreateRoadmap}
				/>

				<SidebarSeparator />

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
