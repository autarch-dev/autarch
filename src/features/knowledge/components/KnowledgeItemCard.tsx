/**
 * KnowledgeItemCard
 *
 * Displays a single knowledge item as a card with a colored left border
 * accent based on its category. Actions (edit, archive, delete) are
 * revealed on hover.
 */

import { Archive, ArchiveRestore, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { KnowledgeItem } from "@/shared/schemas/knowledge";
import { useKnowledgeStore } from "../store/knowledgeStore";
import { CATEGORY_CONFIG, timeAgo } from "../utils/format";
import { KnowledgeEditDialog } from "./KnowledgeEditDialog";

// =============================================================================
// Component
// =============================================================================

interface KnowledgeItemCardProps {
	item: KnowledgeItem;
}

export function KnowledgeItemCard({ item }: KnowledgeItemCardProps) {
	const [editOpen, setEditOpen] = useState(false);
	const [expanded, setExpanded] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const { archiveItem, deleteItem } = useKnowledgeStore();

	const isLongContent = item.content.length > 200;

	const cfg = CATEGORY_CONFIG[item.category];

	const handleArchive = async () => {
		setError(null);
		try {
			await archiveItem(item.id, !item.archived);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to archive item");
		}
	};

	const handleDelete = async () => {
		if (
			!window.confirm("Are you sure you want to delete this knowledge item?")
		) {
			return;
		}
		setError(null);
		try {
			await deleteItem(item.id);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to delete item");
		}
	};

	return (
		<>
			<div
				className={cn(
					"group relative rounded-xl border border-l-4 bg-card text-card-foreground shadow-sm transition-colors hover:border-foreground/10",
					cfg.border,
					item.archived && "opacity-60",
				)}
			>
				{/* Action buttons — visible on hover */}
				<div className="absolute top-3 right-3 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
					<button
						type="button"
						onClick={() => setEditOpen(true)}
						title="Edit"
						className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
					>
						<Pencil className="size-3.5" />
					</button>
					<button
						type="button"
						onClick={handleArchive}
						title={item.archived ? "Unarchive" : "Archive"}
						className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
					>
						{item.archived ? (
							<ArchiveRestore className="size-3.5" />
						) : (
							<Archive className="size-3.5" />
						)}
					</button>
					<button
						type="button"
						onClick={handleDelete}
						title="Delete"
						className="rounded-md p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
					>
						<Trash2 className="size-3.5" />
					</button>
				</div>

				<div className="p-4 space-y-3">
					{/* Category + timestamp */}
					<div className="flex items-center gap-2 text-xs">
						<span
							className={cn(
								"inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-medium",
								cfg.pill,
							)}
						>
							<span className={cn("size-1.5 rounded-full", cfg.dot)} />
							{cfg.label}
						</span>
						<span className="text-muted-foreground">
							{timeAgo(item.createdAt)}
						</span>
						{item.archived && (
							<Badge variant="outline" className="text-xs py-0 px-1.5">
								Archived
							</Badge>
						)}
					</div>

					{/* Title */}
					<h3 className="font-medium text-sm leading-snug pr-20">
						{item.title}
					</h3>

					{/* Content — click to expand/collapse */}
					<div>
						<p
							className={cn(
								"text-sm text-muted-foreground leading-relaxed",
								expanded ? "whitespace-pre-wrap" : "line-clamp-3",
							)}
						>
							{item.content}
						</p>
						{isLongContent && (
							<button
								type="button"
								onClick={() => setExpanded(!expanded)}
								className="text-xs text-muted-foreground/70 hover:text-foreground mt-1 transition-colors"
							>
								{expanded ? "Show less" : "Show more"}
							</button>
						)}
					</div>

					{/* Tags + metadata */}
					<div className="flex items-center gap-2 flex-wrap pt-0.5">
						{item.tags.map((tag) => (
							<span
								key={tag}
								className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
							>
								{tag}
							</span>
						))}
						{item.tags.length > 0 && item.workflowId && (
							<span className="text-border">·</span>
						)}
						{item.workflowId && (
							<span
								className="text-xs text-muted-foreground truncate max-w-[180px]"
								title={item.workflowId}
							>
								{item.workflowId}
							</span>
						)}
					</div>

					{/* Error */}
					{error && <p className="text-destructive text-xs">{error}</p>}
				</div>
			</div>

			<KnowledgeEditDialog
				item={item}
				open={editOpen}
				onOpenChange={setEditOpen}
			/>
		</>
	);
}
