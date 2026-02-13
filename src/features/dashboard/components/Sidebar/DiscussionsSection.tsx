import { ChevronRight, Hash, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
			<Collapsible defaultOpen className="group/collapsible">
				<SidebarGroup>
					<SidebarGroupLabel asChild>
						<CollapsibleTrigger>
							<ChevronRight className="size-3.5 shrink-0 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
							<span>Discussions</span>
							{sortedChannels.length > 0 && (
								<span className="ml-auto mr-4 text-xs tabular-nums text-sidebar-foreground/50">
									{sortedChannels.length}
								</span>
							)}
						</CollapsibleTrigger>
					</SidebarGroupLabel>
					<SidebarGroupAction
						title="New channel"
						onClick={() => setDialogOpen(true)}
					>
						<Plus className="size-4" />
						<span className="sr-only">New channel</span>
					</SidebarGroupAction>
					<CollapsibleContent>
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
										const isActive = location === href;
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
											</SidebarMenuItem>
										);
									})
								)}
							</SidebarMenu>
						</SidebarGroupContent>
					</CollapsibleContent>
				</SidebarGroup>
			</Collapsible>

			<CreateChannelDialog
				open={dialogOpen}
				onOpenChange={setDialogOpen}
				onCreate={onCreateChannel}
			/>
		</>
	);
}
