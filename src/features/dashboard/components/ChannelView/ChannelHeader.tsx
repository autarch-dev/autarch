import { Archive, Hash } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useDiscussionsStore } from "@/features/dashboard/store";
import type { Channel } from "@/shared/schemas/channel";

interface ChannelHeaderProps {
	channel: Channel;
	onArchived?: () => void;
}

export function ChannelHeader({ channel, onArchived }: ChannelHeaderProps) {
	const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false);
	const archiveChannel = useDiscussionsStore((s) => s.archiveChannel);

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
				<Button
					variant="ghost"
					size="icon-sm"
					onClick={() => setIsArchiveDialogOpen(true)}
				>
					<Archive className="size-4" />
				</Button>
			</div>
			<Dialog open={isArchiveDialogOpen} onOpenChange={setIsArchiveDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Archive Channel</DialogTitle>
						<DialogDescription>
							Archive this channel? It will be hidden from the channel list.
							This action cannot be undone.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setIsArchiveDialogOpen(false)}
						>
							Cancel
						</Button>
						<Button
							variant="destructive"
							onClick={async () => {
								try {
									await archiveChannel(channel.id);
									onArchived?.();
								} catch {
									// archive failed, stay on channel
								}
							}}
						>
							Archive
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</header>
	);
}
