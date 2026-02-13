import {
	Sidebar,
	SidebarContent,
	SidebarRail,
	SidebarSeparator,
} from "@/components/ui/sidebar";
import type { RoadmapPerspective } from "@/features/roadmap";
import type { Channel } from "@/shared/schemas/channel";
import type { Roadmap } from "@/shared/schemas/roadmap";
import type { Workflow } from "@/shared/schemas/workflow";
import { DiscussionsSection } from "./DiscussionsSection";
import { NavSection } from "./NavSection";
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
		perspective: RoadmapPerspective,
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
		<Sidebar collapsible="icon" variant="inset">
			<SidebarHeader />

			<SidebarContent className="overflow-x-hidden">
				<NavSection />

				<SidebarSeparator />

				<RoadmapsSection
					roadmaps={roadmaps}
					onCreateRoadmap={onCreateRoadmap}
				/>

				<DiscussionsSection
					channels={channels}
					onCreateChannel={onCreateChannel}
				/>

				<WorkflowsSection
					workflows={workflows}
					onCreateWorkflow={onCreateWorkflow}
				/>
			</SidebarContent>

			<SidebarFooter />
			<SidebarRail />
		</Sidebar>
	);
}
