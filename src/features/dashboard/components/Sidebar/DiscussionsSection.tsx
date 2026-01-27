import { Hash, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import {
	SidebarGroup,
	SidebarGroupAction,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar";
import type { Channel } from "@/shared/schemas/channel";
import type { ViewType } from "../../types";
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

	const sortedChannels = useMemo(
		() =>
			[...channels].sort((a, b) =>
				a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
			),
		[channels],
	);

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
						{sortedChannels.length === 0 ? (
							<SidebarMenuItem>
								<div className="px-2 py-1.5 text-sm text-muted-foreground">
									No channels yet
								</div>
							</SidebarMenuItem>
						) : (
							sortedChannels.map((channel) => (
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
									{/* TODO: Implement unread count tracking */}
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
