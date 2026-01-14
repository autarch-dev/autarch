import { Bell, Hash, MoreHorizontal, Pin, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Channel } from "../../types";

interface ChannelHeaderProps {
	channel: Channel;
}

export function ChannelHeader({ channel }: ChannelHeaderProps) {
	return (
		<header className="flex items-center justify-between px-4 py-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
			<div className="flex items-center gap-2">
				<SidebarTrigger className="-ml-1" />
				<Separator orientation="vertical" className="h-4" />
				<Hash className="size-5 text-muted-foreground" />
				<h2 className="font-semibold">{channel.name}</h2>
				{channel.description && (
					<span className="text-sm text-muted-foreground hidden sm:inline">
						— {channel.description}
					</span>
				)}
			</div>
			<div className="flex items-center gap-1">
				<Tooltip>
					<TooltipTrigger asChild>
						<Button variant="ghost" size="icon-sm">
							<Pin className="size-4" />
						</Button>
					</TooltipTrigger>
					<TooltipContent>Pinned messages</TooltipContent>
				</Tooltip>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button variant="ghost" size="icon-sm">
							<Users className="size-4" />
						</Button>
					</TooltipTrigger>
					<TooltipContent>Members</TooltipContent>
				</Tooltip>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button variant="ghost" size="icon-sm">
							<Bell className="size-4" />
						</Button>
					</TooltipTrigger>
					<TooltipContent>Notifications</TooltipContent>
				</Tooltip>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button variant="ghost" size="icon-sm">
							<MoreHorizontal className="size-4" />
						</Button>
					</TooltipTrigger>
					<TooltipContent>More options</TooltipContent>
				</Tooltip>
			</div>
		</header>
	);
}
