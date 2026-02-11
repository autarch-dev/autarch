import { DollarSign } from "lucide-react";
import { Link, useLocation } from "wouter";
import {
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar";

export function SpendingSection() {
	const [location] = useLocation();
	const isActive = location === "/costs";

	return (
		<SidebarGroup>
			<SidebarGroupLabel>Spending</SidebarGroupLabel>
			<SidebarGroupContent>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton asChild isActive={isActive}>
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
