import { Circle, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import {
	SidebarGroup,
	SidebarGroupAction,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar";
import { CreateRoadmapDialog } from "@/features/roadmap";
import { cn } from "@/lib/utils";
import type { Roadmap } from "@/shared/schemas/roadmap";

const roadmapStatusColors = {
	draft: "text-muted-foreground",
	active: "text-blue-500",
	completed: "text-green-500",
	archived: "text-gray-400",
} as const;

interface RoadmapsSectionProps {
	roadmaps: Roadmap[];
	onCreateRoadmap: (
		title: string,
		mode: "ai" | "blank",
		prompt?: string,
	) => Promise<void>;
}

export function RoadmapsSection({
	roadmaps,
	onCreateRoadmap,
}: RoadmapsSectionProps) {
	const [dialogOpen, setDialogOpen] = useState(false);
	const [location] = useLocation();

	const sortedRoadmaps = useMemo(
		() =>
			[...roadmaps]
				.filter((r) => r.status !== "archived")
				.sort((a, b) =>
					a.title.localeCompare(b.title, undefined, { sensitivity: "base" }),
				),
		[roadmaps],
	);

	return (
		<>
			<CreateRoadmapDialog
				open={dialogOpen}
				onOpenChange={setDialogOpen}
				onCreate={onCreateRoadmap}
			/>

			<SidebarGroup>
				<SidebarGroupLabel>Roadmaps</SidebarGroupLabel>
				<SidebarGroupAction
					title="New roadmap"
					onClick={() => setDialogOpen(true)}
				>
					<Plus className="size-4" />
					<span className="sr-only">New roadmap</span>
				</SidebarGroupAction>
				<SidebarGroupContent>
					<SidebarMenu>
						{sortedRoadmaps.length === 0 ? (
							<SidebarMenuItem>
								<div className="px-2 py-1.5 text-sm text-muted-foreground">
									No roadmaps yet
								</div>
							</SidebarMenuItem>
						) : (
							sortedRoadmaps.map((roadmap) => {
								const href = `/roadmap/${roadmap.id}`;
								const isActive = location === `/dashboard${href}`;
								return (
									<SidebarMenuItem key={roadmap.id}>
										<SidebarMenuButton
											asChild
											isActive={isActive}
											tooltip={roadmap.title}
										>
											<Link href={href}>
												<Circle
													className={cn(
														"size-3 shrink-0 fill-current",
														roadmapStatusColors[roadmap.status],
													)}
												/>
												<span className="truncate">{roadmap.title}</span>
											</Link>
										</SidebarMenuButton>
									</SidebarMenuItem>
								);
							})
						)}
					</SidebarMenu>
				</SidebarGroupContent>
			</SidebarGroup>
		</>
	);
}
