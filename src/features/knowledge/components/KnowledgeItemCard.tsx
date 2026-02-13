/**
 * KnowledgeItemCard
 *
 * Displays a single knowledge item as a card with title, content preview,
 * category badge, tag badges, workflow link, timestamp, and action buttons
 * (edit, archive/unarchive, delete).
 */

import { Archive, ArchiveRestore, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { KnowledgeItem } from "@/shared/schemas/knowledge";
import { useKnowledgeStore } from "../store/knowledgeStore";
import { categoryVariant, truncate } from "../utils/format";
import { KnowledgeEditDialog } from "./KnowledgeEditDialog";

// =============================================================================
// Component
// =============================================================================

interface KnowledgeItemCardProps {
	item: KnowledgeItem;
}

export function KnowledgeItemCard({ item }: KnowledgeItemCardProps) {
	const [editOpen, setEditOpen] = useState(false);
	const { archiveItem, deleteItem } = useKnowledgeStore();

	const handleArchive = () => {
		archiveItem(item.id, !item.archived);
	};

	const handleDelete = () => {
		if (
			window.confirm("Are you sure you want to delete this knowledge item?")
		) {
			deleteItem(item.id);
		}
	};

	return (
		<>
			<Card>
				<CardHeader>
					<div className="flex items-start justify-between gap-2">
						<div className="min-w-0 flex-1">
							<CardTitle className="text-base">{item.title}</CardTitle>
						</div>
						<div className="flex shrink-0 items-center gap-1">
							<Button
								variant="ghost"
								size="icon-sm"
								onClick={() => setEditOpen(true)}
								title="Edit"
							>
								<Pencil className="size-4" />
							</Button>
							<Button
								variant="ghost"
								size="icon-sm"
								onClick={handleArchive}
								title={item.archived ? "Unarchive" : "Archive"}
							>
								{item.archived ? (
									<ArchiveRestore className="size-4" />
								) : (
									<Archive className="size-4" />
								)}
							</Button>
							<Button
								variant="ghost"
								size="icon-sm"
								onClick={handleDelete}
								title="Delete"
							>
								<Trash2 className="size-4" />
							</Button>
						</div>
					</div>
				</CardHeader>

				<CardContent className="space-y-3">
					{/* Content preview */}
					<p className="text-sm text-muted-foreground">
						{truncate(item.content)}
					</p>

					{/* Category + tags */}
					<div className="flex flex-wrap items-center gap-1.5">
						<Badge variant={categoryVariant(item.category)}>
							{item.category}
						</Badge>
						{item.tags.map((tag) => (
							<Badge key={tag} variant="outline" className="text-xs">
								{tag}
							</Badge>
						))}
					</div>

					{/* Workflow link + timestamp */}
					<div className="flex items-center justify-between text-xs text-muted-foreground">
						{item.workflowId && (
							<span className="truncate" title={item.workflowId}>
								Workflow: {item.workflowId}
							</span>
						)}
						<span className="shrink-0">
							{new Date(item.createdAt).toLocaleDateString()}
						</span>
					</div>
				</CardContent>
			</Card>

			<KnowledgeEditDialog
				item={item}
				open={editOpen}
				onOpenChange={setEditOpen}
			/>
		</>
	);
}
