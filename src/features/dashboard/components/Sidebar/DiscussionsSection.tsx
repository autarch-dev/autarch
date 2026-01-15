import { Hash, Plus } from "lucide-react";
import {
	SidebarGroup,
	SidebarGroupAction,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuBadge,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar";
import type { Channel, ViewType } from "../../types";

interface DiscussionsSectionProps {
	channels: Channel[];
	selectedView: ViewType;
	selectedId: string | null;
	onSelectChannel: (channelId: string) => void;
}

export function DiscussionsSection({
	channels,
	selectedView,
	selectedId,
	onSelectChannel,
}: DiscussionsSectionProps) {
	return (
		<SidebarGroup>
			<SidebarGroupLabel>Discussions</SidebarGroupLabel>
			<SidebarGroupAction title="New channel">
				<Plus className="size-4" />
				<span className="sr-only">New channel</span>
			</SidebarGroupAction>
			<SidebarGroupContent>
				<SidebarMenu>
					{channels.map((channel) => (
						<SidebarMenuItem key={channel.id}>
							<SidebarMenuButton
								onClick={() => onSelectChannel(channel.id)}
								isActive={
									selectedView === "channel" && selectedId === channel.id
								}
								tooltip={`#${channel.name}`}
							>
								<Hash className="size-4" />
								<span>{channel.name}</span>
							</SidebarMenuButton>
							{channel.unreadCount && channel.unreadCount > 0 ? (
								<SidebarMenuBadge>{channel.unreadCount}</SidebarMenuBadge>
							) : null}
						</SidebarMenuItem>
					))}
				</SidebarMenu>
			</SidebarGroupContent>
		</SidebarGroup>
	);
}
