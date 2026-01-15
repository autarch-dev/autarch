import { Database, Loader2 } from "lucide-react";
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { useWebSocketStore } from "@/features/websocket/store";

export function EmbeddingStatus() {
	const indexingProgress = useWebSocketStore((state) => state.indexingProgress);

	const isIndexing =
		indexingProgress !== null && indexingProgress.phase !== "completed";
	const progressPercent =
		indexingProgress && indexingProgress.totalFiles > 0
			? Math.round(
					(indexingProgress.filesProcessed / indexingProgress.totalFiles) * 100,
				)
			: 0;

	return (
		<SidebarMenuItem>
			<SidebarMenuButton
				tooltip={
					isIndexing ? `Indexing: ${progressPercent}%` : "Code search ready"
				}
				className="cursor-default hover:bg-transparent"
			>
				{isIndexing ? (
					<Loader2 className="size-4 shrink-0 animate-spin text-blue-500" />
				) : (
					<Database className="size-4 shrink-0 text-green-500" />
				)}
				<span className="truncate text-muted-foreground">
					{isIndexing
						? `Indexing ${indexingProgress?.filesProcessed ?? 0}/${indexingProgress?.totalFiles ?? 0}`
						: "Code search ready"}
				</span>
			</SidebarMenuButton>
		</SidebarMenuItem>
	);
}
