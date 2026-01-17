import { useState } from "react";
import { Settings } from "lucide-react";
import {
	SidebarFooter as BaseSidebarFooter,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar";
import { SettingsPanel } from "@/features/settings/components/SettingsPanel";
import { EmbeddingStatus } from "./EmbeddingStatus";

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
				<EmbeddingStatus />
			</SidebarMenu>
			<SettingsPanel open={open} onOpenChange={setOpen} />
		</BaseSidebarFooter>
	);
}
