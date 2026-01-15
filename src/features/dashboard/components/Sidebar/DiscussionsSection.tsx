import { Hash, Plus } from "lucide-react";
import { useState } from "react";
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
import { CreateChannelDialog } from "./CreateChannelDialog";

interface DiscussionsSectionProps {
	channels: Channel[];
	selectedView: ViewType;
	selectedId: string | null;
	onSelectChannel: (channelId: string) => void;
	onCreateChannel: (name: string, description?: string) => Promise<void>;
}

export function DiscussionsSection({
	channels,
	selectedView,
	selectedId,
	onSelectChannel,
	onCreateChannel,
}: DiscussionsSectionProps) {
	const [dialogOpen, setDialogOpen] = useState(false);

	return (
		<>
			<SidebarGroup>
				<SidebarGroupLabel>Discussions</SidebarGroupLabel>
				<SidebarGroupAction
					title="New channel"
					onClick={() => setDialogOpen(true)}
				>
					<Plus className="size-4" />
					<span className="sr-only">New channel</span>
				</SidebarGroupAction>
				<SidebarGroupContent>
					<SidebarMenu>
						{channels.length === 0 ? (
							<SidebarMenuItem>
								<div className="px-2 py-1.5 text-sm text-muted-foreground">
									No channels yet
								</div>
							</SidebarMenuItem>
						) : (
							channels.map((channel) => (
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
							))
						)}
					</SidebarMenu>
				</SidebarGroupContent>
			</SidebarGroup>

			<CreateChannelDialog
				open={dialogOpen}
				onOpenChange={setDialogOpen}
				onCreate={onCreateChannel}
			/>
		</>
	);
}
