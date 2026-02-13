import { Loader2, Wifi, WifiOff } from "lucide-react";
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { useWebSocketStore } from "@/features/websocket/store";

export function ConnectionStatus() {
	const connectionStatus = useWebSocketStore((state) => state.connectionStatus);
	const retryCount = useWebSocketStore((state) => state.retryCount);
	const reconnect = useWebSocketStore((state) => state.reconnect);

	return (
		<SidebarMenuItem>
			{connectionStatus === "connected" && (
				<SidebarMenuButton
					tooltip="Connected"
					className="cursor-default hover:bg-transparent"
				>
					<Wifi className="size-4 shrink-0 text-green-500" />
					<span className="truncate text-muted-foreground">Connected</span>
				</SidebarMenuButton>
			)}
			{connectionStatus === "reconnecting" && (
				<SidebarMenuButton
					tooltip="Reconnecting..."
					className="cursor-default hover:bg-transparent"
				>
					<Loader2 className="size-4 shrink-0 animate-spin text-amber-500" />
					<span className="truncate text-muted-foreground">
						Reconnecting ({retryCount}/10)
					</span>
				</SidebarMenuButton>
			)}
			{connectionStatus === "disconnected" && (
				<SidebarMenuButton
					tooltip="Disconnected – click to reconnect"
					onClick={() => reconnect()}
				>
					<WifiOff className="size-4 shrink-0 text-red-500" />
					<span className="truncate text-muted-foreground">Reconnect</span>
				</SidebarMenuButton>
			)}
		</SidebarMenuItem>
	);
}
