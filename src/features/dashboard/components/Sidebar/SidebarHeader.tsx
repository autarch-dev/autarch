import { ChevronDown, Folder, Search } from "lucide-react";
import { useEffect } from "react";
import { useLocation } from "wouter";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	SidebarHeader as BaseSidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useProjectStore } from "../../store";

export function SidebarHeader() {
	const { project, fetchProject } = useProjectStore();
	const [, setLocation] = useLocation();

	useEffect(() => {
		fetchProject();
	}, [fetchProject]);

	return (
		<BaseSidebarHeader>
			<SidebarMenu>
				<SidebarMenuItem>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<SidebarMenuButton size="lg" tooltip="Project">
								{project?.hasIcon ? (
									<img
										src="/api/project/icon"
										alt=""
										className="size-8 rounded-lg object-contain"
									/>
								) : (
									<div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
										<Folder className="size-4" />
									</div>
								)}
								<div className="grid flex-1 text-left text-sm leading-tight">
									<span className="truncate font-semibold">
										{project?.name ?? "Loading..."}
									</span>
									<span className="truncate text-xs text-muted-foreground">
										{project?.displayPath ?? ""}
									</span>
								</div>
								<ChevronDown className="ml-auto size-4" />
							</SidebarMenuButton>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="start">
							<DropdownMenuItem onClick={() => setLocation("/testbench")}>
								Tool Testbench
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
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
