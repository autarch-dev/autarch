import { ChevronDown, Search, Sparkles } from "lucide-react";
import {
	SidebarHeader as BaseSidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar";

export function SidebarHeader() {
	return (
		<BaseSidebarHeader>
			<SidebarMenu>
				<SidebarMenuItem>
					<SidebarMenuButton size="lg" tooltip="Project">
						<div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
							<Sparkles className="size-4" />
						</div>
						<div className="grid flex-1 text-left text-sm leading-tight">
							<span className="truncate font-semibold">autarch-cli</span>
							<span className="truncate text-xs text-muted-foreground">
								~/Repos/autarch-cli
							</span>
						</div>
						<ChevronDown className="ml-auto size-4" />
					</SidebarMenuButton>
				</SidebarMenuItem>
			</SidebarMenu>

			{/* Search */}
			<SidebarMenu>
				<SidebarMenuItem>
					<SidebarMenuButton tooltip="Search">
						<Search className="size-4 shrink-0" />
						<span className="truncate">Search...</span>
						<kbd className="ml-auto text-[10px] bg-muted px-1.5 py-0.5 rounded pointer-events-none shrink-0">
							⌘K
						</kbd>
					</SidebarMenuButton>
				</SidebarMenuItem>
			</SidebarMenu>
		</BaseSidebarHeader>
	);
}
