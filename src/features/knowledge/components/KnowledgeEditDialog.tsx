/**
 * KnowledgeEditDialog
 *
 * Dialog for editing a knowledge item inline. Contains a form with
 * title, content, category select, and comma-separated tags input.
 * Calls store.updateItem() on save.
 */

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type {
	KnowledgeCategory,
	KnowledgeItem,
} from "@/shared/schemas/knowledge";
import { useKnowledgeStore } from "../store/knowledgeStore";

// =============================================================================
// Constants
// =============================================================================

const CATEGORY_OPTIONS: { value: KnowledgeCategory; label: string }[] = [
	{ value: "pattern", label: "Pattern" },
	{ value: "gotcha", label: "Gotcha" },
	{ value: "tool-usage", label: "Tool Usage" },
	{ value: "process-improvement", label: "Process Improvement" },
];

// =============================================================================
// Component
// =============================================================================

interface KnowledgeEditDialogProps {
	item: KnowledgeItem | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function KnowledgeEditDialog({
	item,
	open,
	onOpenChange,
}: KnowledgeEditDialogProps) {
	const { updateItem } = useKnowledgeStore();

	const [title, setTitle] = useState("");
	const [content, setContent] = useState("");
	const [category, setCategory] = useState<KnowledgeCategory>("pattern");
	const [tags, setTags] = useState("");

	// Re-initialize form fields whenever the item changes or dialog opens
	useEffect(() => {
		if (item && open) {
			setTitle(item.title);
			setContent(item.content);
			setCategory(item.category);
			setTags(item.tags.join(", "));
		}
	}, [item, open]);

	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const canSave =
		title.trim().length > 0 && content.trim().length > 0 && !saving;

	const handleSave = async () => {
		if (!item || !canSave) return;

		const parsedTags = tags
			.split(",")
			.map((t) => t.trim())
			.filter((t) => t.length > 0);

		setSaving(true);
		setError(null);

		try {
			await updateItem(item.id, {
				title: title.trim(),
				content: content.trim(),
				category,
				tags: parsedTags,
			});
			onOpenChange(false);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to save changes");
		} finally {
			setSaving(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Edit Knowledge Item</DialogTitle>
				</DialogHeader>

				<div className="space-y-4 py-4">
					{/* Title */}
					<div className="space-y-2">
						<Label htmlFor="knowledge-title">Title</Label>
						<Input
							id="knowledge-title"
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							placeholder="Item title"
						/>
					</div>

					{/* Content */}
					<div className="space-y-2">
						<Label htmlFor="knowledge-content">Content</Label>
						<Textarea
							id="knowledge-content"
							value={content}
							onChange={(e) => setContent(e.target.value)}
							placeholder="Knowledge content…"
							rows={5}
						/>
					</div>

					{/* Category */}
					<div className="space-y-2">
						<Label htmlFor="knowledge-category">Category</Label>
						<Select
							value={category}
							onValueChange={(val) => setCategory(val as KnowledgeCategory)}
						>
							<SelectTrigger id="knowledge-category">
								<SelectValue placeholder="Select category" />
							</SelectTrigger>
							<SelectContent>
								{CATEGORY_OPTIONS.map((opt) => (
									<SelectItem key={opt.value} value={opt.value}>
										{opt.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					{/* Tags */}
					<div className="space-y-2">
						<Label htmlFor="knowledge-tags">Tags</Label>
						<Input
							id="knowledge-tags"
							value={tags}
							onChange={(e) => setTags(e.target.value)}
							placeholder="tag1, tag2, tag3"
						/>
						<p className="text-xs text-muted-foreground">
							Separate tags with commas
						</p>
					</div>
				</div>

				{error && <p className="text-destructive text-sm">{error}</p>}

				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button onClick={handleSave} disabled={!canSave}>
						{saving ? "Saving…" : "Save"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
