import { ChevronRight, Search } from "lucide-react";
import { Fragment, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useRoadmapStore } from "@/features/roadmap";
import { useDiscussionsStore, useWorkflowsStore } from "../store";

interface Breadcrumb {
	label: string;
	href?: string;
}

function useBreadcrumbs(): Breadcrumb[] {
	const [location] = useLocation();
	const workflows = useWorkflowsStore((s) => s.workflows);
	const channels = useDiscussionsStore((s) => s.channels);
	const roadmaps = useRoadmapStore((s) => s.roadmaps);

	return useMemo(() => {
		if (location === "/") {
			return [{ label: "Home" }];
		}

		const segments = location.split("/").filter(Boolean);
		const crumbs: Breadcrumb[] = [];

		switch (segments[0]) {
			case "workflow": {
				const id = segments[1];
				const workflow = workflows.find((w) => w.id === id);
				crumbs.push({ label: "Workflows" });
				crumbs.push({ label: workflow?.title ?? "Workflow" });
				break;
			}
			case "channel": {
				const id = segments[1];
				const channel = channels.find((c) => c.id === id);
				crumbs.push({ label: "Discussions" });
				crumbs.push({
					label: channel ? `#${channel.name}` : "Channel",
				});
				break;
			}
			case "roadmap": {
				const id = segments[1];
				const roadmap = roadmaps.find((r) => r.id === id);
				crumbs.push({ label: "Roadmaps" });
				crumbs.push({ label: roadmap?.title ?? "Roadmap" });
				break;
			}
			case "analytics":
				crumbs.push({ label: "Analytics" });
				break;
			case "costs":
				crumbs.push({ label: "Cost Dashboard" });
				break;
			case "knowledge":
				crumbs.push({ label: "Knowledge Base" });
				break;
			case "completed":
				crumbs.push({ label: "Workflows" });
				crumbs.push({ label: "Completed" });
				break;
		}

		return crumbs;
	}, [location, workflows, channels, roadmaps]);
}

export function ContentHeader() {
	const breadcrumbs = useBreadcrumbs();

	return (
		<header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
			<SidebarTrigger className="-ml-1" />
			<div className="mx-2 h-4 w-px shrink-0 bg-border" />
			<nav
				className="flex items-center gap-1.5 text-sm min-w-0"
				aria-label="Breadcrumb"
			>
				{breadcrumbs.map((crumb, index) => (
					<Fragment key={`${crumb.label}-${index}`}>
						{index > 0 && (
							<ChevronRight className="size-3.5 shrink-0 text-muted-foreground/50" />
						)}
						{crumb.href ? (
							<Link
								href={crumb.href}
								className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
							>
								{crumb.label}
							</Link>
						) : index === breadcrumbs.length - 1 ? (
							<span className="font-medium text-foreground truncate">
								{crumb.label}
							</span>
						) : (
							<span className="text-muted-foreground shrink-0">
								{crumb.label}
							</span>
						)}
					</Fragment>
				))}
			</nav>
			<div className="ml-auto flex items-center">
				<button
					type="button"
					className="flex items-center gap-2 rounded-md border px-2.5 py-1 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
					onClick={() =>
						window.dispatchEvent(new Event("open-command-palette"))
					}
				>
					<Search className="size-3.5" />
					<span className="hidden sm:inline">Search</span>
					<kbd className="hidden sm:inline-flex h-5 items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
						⌘K
					</kbd>
				</button>
			</div>
		</header>
	);
}
