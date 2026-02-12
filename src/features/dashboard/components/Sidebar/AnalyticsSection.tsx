import { BarChart3, DollarSign } from "lucide-react";
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
	const isWorkflowAnalyticsActive = location === "/analytics";
	const isCostDashboardActive = location === "/costs";

	return (
		<SidebarGroup>
			<SidebarGroupLabel>Analytics</SidebarGroupLabel>
			<SidebarGroupContent>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton asChild isActive={isWorkflowAnalyticsActive}>
							<Link href="/analytics">
								<BarChart3 className="size-4" />
								<span>Workflow Analytics</span>
							</Link>
						</SidebarMenuButton>
					</SidebarMenuItem>
					<SidebarMenuItem>
						<SidebarMenuButton asChild isActive={isCostDashboardActive}>
							<Link href="/costs">
								<DollarSign className="size-4" />
								<span>Cost Dashboard</span>
							</Link>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarGroupContent>
		</SidebarGroup>
	);
}
