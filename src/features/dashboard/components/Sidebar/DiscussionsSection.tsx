import { Hash, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
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
import { CreateChannelDialog } from "./CreateChannelDialog";

interface DiscussionsSectionProps {
	channels: Channel[];
	onCreateChannel: (name: string, description?: string) => Promise<void>;
}

export function DiscussionsSection({
	channels,
	onCreateChannel,
}: DiscussionsSectionProps) {
	const [dialogOpen, setDialogOpen] = useState(false);
	const [location] = useLocation();

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
							sortedChannels.map((channel) => {
								const href = `/channel/${channel.id}`;
								const isActive = location === `/dashboard${href}`;
								return (
									<SidebarMenuItem key={channel.id}>
										<SidebarMenuButton
											asChild
											isActive={isActive}
											tooltip={`#${channel.name}`}
										>
											<Link href={href}>
												<Hash className="size-4" />
												<span>{channel.name}</span>
											</Link>
										</SidebarMenuButton>
										{/* TODO: Implement unread count tracking */}
									</SidebarMenuItem>
								);
							})
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
