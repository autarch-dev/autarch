import { ChevronRight, Circle, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	SidebarGroup,
	SidebarGroupAction,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
	CreateRoadmapDialog,
	type RoadmapPerspective,
} from "@/features/roadmap";
import { cn } from "@/lib/utils";
import type { Roadmap } from "@/shared/schemas/roadmap";

const roadmapStatusColors = {
	draft: "text-muted-foreground",
	active: "text-blue-500",
	completed: "text-green-500",
	archived: "text-gray-400",
	error: "text-red-500",
} as const;

interface RoadmapsSectionProps {
	roadmaps: Roadmap[];
	onCreateRoadmap: (
		title: string,
		perspective: RoadmapPerspective,
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

			<Collapsible defaultOpen className="group/collapsible">
				<SidebarGroup>
					<SidebarGroupLabel asChild>
						<CollapsibleTrigger>
							<ChevronRight className="size-3.5 shrink-0 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
							<span>Roadmaps</span>
							{sortedRoadmaps.length > 0 && (
								<span className="ml-auto mr-4 text-xs tabular-nums text-sidebar-foreground/50">
									{sortedRoadmaps.length}
								</span>
							)}
						</CollapsibleTrigger>
					</SidebarGroupLabel>
					<SidebarGroupAction
						title="New roadmap"
						onClick={() => setDialogOpen(true)}
					>
						<Plus className="size-4" />
						<span className="sr-only">New roadmap</span>
					</SidebarGroupAction>
					<CollapsibleContent>
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
										const isActive = location === href;
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
					</CollapsibleContent>
				</SidebarGroup>
			</Collapsible>
		</>
	);
}
