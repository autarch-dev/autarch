import { BarChart3, BookOpen, DollarSign, LayoutDashboard } from "lucide-react";
import { Link, useLocation } from "wouter";
import {
	SidebarGroup,
	SidebarGroupContent,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar";

const navItems = [
	{ label: "Home", icon: LayoutDashboard, href: "/" },
	{ label: "Analytics", icon: BarChart3, href: "/analytics" },
	{ label: "Costs", icon: DollarSign, href: "/costs" },
	{ label: "Knowledge", icon: BookOpen, href: "/knowledge" },
];

export function NavSection() {
	const [location] = useLocation();

	return (
		<SidebarGroup>
			<SidebarGroupContent>
				<SidebarMenu>
					{navItems.map((item) => {
						const isActive = location === item.href;
						return (
							<SidebarMenuItem key={item.href}>
								<SidebarMenuButton
									asChild
									isActive={isActive}
									tooltip={item.label}
								>
									<Link href={item.href}>
										<item.icon className="size-4" />
										<span>{item.label}</span>
									</Link>
								</SidebarMenuButton>
							</SidebarMenuItem>
						);
					})}
				</SidebarMenu>
			</SidebarGroupContent>
		</SidebarGroup>
	);
}
