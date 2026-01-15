import { Settings } from "lucide-react";
import {
	SidebarFooter as BaseSidebarFooter,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar";
import { EmbeddingStatus } from "./EmbeddingStatus";

export function SidebarFooter() {
	return (
		<BaseSidebarFooter>
			<SidebarMenu>
				<SidebarMenuItem>
					<SidebarMenuButton tooltip="Settings">
						<Settings className="size-4" />
						<span>Settings</span>
					</SidebarMenuButton>
				</SidebarMenuItem>
				<EmbeddingStatus />
			</SidebarMenu>
		</BaseSidebarFooter>
	);
}
