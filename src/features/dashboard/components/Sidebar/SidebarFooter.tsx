import { Loader2, Settings } from "lucide-react";
import { useState } from "react";
import {
	SidebarFooter as BaseSidebarFooter,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar";
import { SettingsPanel } from "@/features/settings/components/SettingsPanel";
import { useWebSocketStore } from "@/features/websocket/store";

function StatusBar() {
	const connectionStatus = useWebSocketStore((s) => s.connectionStatus);
	const retryCount = useWebSocketStore((s) => s.retryCount);
	const reconnect = useWebSocketStore((s) => s.reconnect);
	const indexingProgress = useWebSocketStore((s) => s.indexingProgress);

	const isIndexing =
		indexingProgress !== null && indexingProgress.phase !== "completed";
	const progressPercent =
		indexingProgress && indexingProgress.totalFiles > 0
			? Math.round(
					(indexingProgress.filesProcessed / indexingProgress.totalFiles) * 100,
				)
			: 0;

	return (
		<div className="flex items-center gap-3 px-3 py-2 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
			{/* Connection */}
			{connectionStatus === "connected" && (
				<div className="flex items-center gap-1.5">
					<div className="size-1.5 rounded-full bg-green-500 shrink-0" />
					<span>Connected</span>
				</div>
			)}
			{connectionStatus === "reconnecting" && (
				<div className="flex items-center gap-1.5">
					<Loader2 className="size-3 animate-spin text-amber-500 shrink-0" />
					<span>Reconnecting ({retryCount}/10)</span>
				</div>
			)}
			{connectionStatus === "disconnected" && (
				<button
					type="button"
					onClick={() => reconnect()}
					className="flex items-center gap-1.5 hover:text-foreground transition-colors"
				>
					<div className="size-1.5 rounded-full bg-red-500 shrink-0" />
					<span>Reconnect</span>
				</button>
			)}

			<div className="h-3 w-px bg-border shrink-0" />

			{/* Indexing */}
			{isIndexing ? (
				<div className="flex items-center gap-1.5">
					<Loader2 className="size-3 animate-spin text-blue-500 shrink-0" />
					<span>Indexing {progressPercent}%</span>
				</div>
			) : (
				<div className="flex items-center gap-1.5">
					<div className="size-1.5 rounded-full bg-green-500 shrink-0" />
					<span>Indexed</span>
				</div>
			)}
		</div>
	);
}

export function SidebarFooter() {
	const [open, setOpen] = useState(false);

	return (
		<BaseSidebarFooter>
			<SidebarMenu>
				<SidebarMenuItem>
					<SidebarMenuButton tooltip="Settings" onClick={() => setOpen(true)}>
						<Settings className="size-4" />
						<span>Settings</span>
					</SidebarMenuButton>
				</SidebarMenuItem>
			</SidebarMenu>
			<StatusBar />
			<SettingsPanel open={open} onOpenChange={setOpen} />
		</BaseSidebarFooter>
	);
}
