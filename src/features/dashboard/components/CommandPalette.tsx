import {
	BarChart3,
	BookOpen,
	CheckCircle2,
	Circle,
	DollarSign,
	Hash,
	LayoutDashboard,
	MapIcon,
	Search,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "@/components/ui/dialog";
import { useRoadmapStore } from "@/features/roadmap";
import { cn } from "@/lib/utils";
import { useDiscussionsStore, useWorkflowsStore } from "../store";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CommandItem {
	id: string;
	label: string;
	icon: React.ReactNode;
	href: string;
	group: string;
}

// ---------------------------------------------------------------------------
// Static pages
// ---------------------------------------------------------------------------

const staticPages: CommandItem[] = [
	{
		id: "page-home",
		label: "Home",
		icon: <LayoutDashboard className="size-4" />,
		href: "/",
		group: "Pages",
	},
	{
		id: "page-analytics",
		label: "Analytics",
		icon: <BarChart3 className="size-4" />,
		href: "/analytics",
		group: "Pages",
	},
	{
		id: "page-costs",
		label: "Cost Dashboard",
		icon: <DollarSign className="size-4" />,
		href: "/costs",
		group: "Pages",
	},
	{
		id: "page-knowledge",
		label: "Knowledge Base",
		icon: <BookOpen className="size-4" />,
		href: "/knowledge",
		group: "Pages",
	},
	{
		id: "page-completed",
		label: "Completed Workflows",
		icon: <CheckCircle2 className="size-4" />,
		href: "/completed",
		group: "Pages",
	},
];

// ---------------------------------------------------------------------------
// CommandPalette
// ---------------------------------------------------------------------------

export function CommandPalette() {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [, setLocation] = useLocation();
	const scrollRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	// Store data
	const workflows = useWorkflowsStore((s) => s.workflows);
	const channels = useDiscussionsStore((s) => s.channels);
	const roadmaps = useRoadmapStore((s) => s.roadmaps);

	// Listen for ⌘K and custom event
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key === "k") {
				e.preventDefault();
				setOpen(true);
			}
		};
		const handleCustom = () => setOpen(true);

		window.addEventListener("keydown", handleKeyDown);
		window.addEventListener("open-command-palette", handleCustom);
		return () => {
			window.removeEventListener("keydown", handleKeyDown);
			window.removeEventListener("open-command-palette", handleCustom);
		};
	}, []);

	// Build searchable items
	const allItems = useMemo<CommandItem[]>(() => {
		const items: CommandItem[] = [...staticPages];

		for (const w of workflows) {
			items.push({
				id: `wf-${w.id}`,
				label: w.title,
				icon: <Circle className="size-4" />,
				href: `/workflow/${w.id}`,
				group: "Workflows",
			});
		}

		for (const c of channels) {
			items.push({
				id: `ch-${c.id}`,
				label: `#${c.name}`,
				icon: <Hash className="size-4" />,
				href: `/channel/${c.id}`,
				group: "Channels",
			});
		}

		for (const r of roadmaps) {
			if (r.status === "archived") continue;
			items.push({
				id: `rm-${r.id}`,
				label: r.title,
				icon: <MapIcon className="size-4" />,
				href: `/roadmap/${r.id}`,
				group: "Roadmaps",
			});
		}

		return items;
	}, [workflows, channels, roadmaps]);

	// Filter items
	const filteredItems = useMemo(() => {
		if (!query.trim()) return allItems;
		const lowerQuery = query.toLowerCase();
		return allItems.filter((item) =>
			item.label.toLowerCase().includes(lowerQuery),
		);
	}, [query, allItems]);

	// Group items for display
	type IndexedItem = CommandItem & { flatIndex: number };
	const groups = useMemo(() => {
		const result: Record<string, IndexedItem[]> = {};
		filteredItems.forEach((item, index) => {
			const group = result[item.group] ?? [];
			group.push({ ...item, flatIndex: index });
			result[item.group] = group;
		});
		return result;
	}, [filteredItems]);

	// Scroll selected into view
	useEffect(() => {
		if (scrollRef.current) {
			const el = scrollRef.current.querySelector(
				`[data-index="${selectedIndex}"]`,
			);
			el?.scrollIntoView({ block: "nearest" });
		}
	}, [selectedIndex]);

	// Navigation
	const handleSelect = useCallback(
		(href: string) => {
			setLocation(href);
			setOpen(false);
			setQuery("");
		},
		[setLocation],
	);

	// Keyboard handler
	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			switch (e.key) {
				case "ArrowDown":
					e.preventDefault();
					setSelectedIndex((i) =>
						Math.min(i + 1, filteredItems.length - 1),
					);
					break;
				case "ArrowUp":
					e.preventDefault();
					setSelectedIndex((i) => Math.max(i - 1, 0));
					break;
				case "Enter":
					e.preventDefault();
					if (filteredItems[selectedIndex]) {
						handleSelect(filteredItems[selectedIndex].href);
					}
					break;
			}
		},
		[filteredItems, selectedIndex, handleSelect],
	);

	return (
		<Dialog
			open={open}
			onOpenChange={(v) => {
				setOpen(v);
				if (!v) setQuery("");
			}}
		>
			<DialogContent
				showCloseButton={false}
				className="p-0 gap-0 max-w-lg overflow-hidden"
				onKeyDown={handleKeyDown}
			>
				<DialogTitle className="sr-only">Command Palette</DialogTitle>
				<DialogDescription className="sr-only">
					Search and navigate to any page, workflow, channel, or roadmap
				</DialogDescription>

				{/* Search input */}
				<div className="flex items-center border-b px-4">
					<Search className="size-4 shrink-0 text-muted-foreground" />
					<input
						ref={inputRef}
						className="flex h-12 w-full bg-transparent px-3 py-3 text-sm outline-none placeholder:text-muted-foreground"
						placeholder="Search or jump to..."
						value={query}
						onChange={(e) => {
							setQuery(e.target.value);
							setSelectedIndex(0);
						}}
						autoFocus
					/>
					<kbd className="hidden sm:inline-flex h-5 items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground shrink-0">
						esc
					</kbd>
				</div>

				{/* Results */}
				<div
					ref={scrollRef}
					className="max-h-[320px] overflow-y-auto p-2"
				>
					{filteredItems.length === 0 ? (
						<div className="py-8 text-center text-sm text-muted-foreground">
							No results found
						</div>
					) : (
						Object.entries(groups).map(
							([groupName, groupItems]) => (
								<div key={groupName} className="mb-1 last:mb-0">
									<div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
										{groupName}
									</div>
									{groupItems.map((item) => (
										<button
											key={item.id}
											type="button"
											data-index={item.flatIndex}
											className={cn(
												"flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors text-left outline-none",
												item.flatIndex === selectedIndex
													? "bg-accent text-accent-foreground"
													: "hover:bg-accent/50",
											)}
											onClick={() =>
												handleSelect(item.href)
											}
											onMouseEnter={() =>
												setSelectedIndex(item.flatIndex)
											}
										>
											<span className="shrink-0 text-muted-foreground">
												{item.icon}
											</span>
											<span className="truncate">
												{item.label}
											</span>
										</button>
									))}
								</div>
							),
						)
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
