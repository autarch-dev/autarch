import { BarChart3 } from "lucide-react";
import { Link, useLocation } from "wouter";
import {
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar";

export function AnalyticsSection() {
	const [location] = useLocation();
	const isActive = location === "/analytics";

	return (
		<SidebarGroup>
			<SidebarGroupLabel>Analytics</SidebarGroupLabel>
			<SidebarGroupContent>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton asChild isActive={isActive}>
							<Link href="/analytics">
								<BarChart3 className="size-4" />
								<span>Workflow Analytics</span>
							</Link>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarGroupContent>
		</SidebarGroup>
	);
}
