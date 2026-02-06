/**
 * VisionDocument - View/edit component for a roadmap's vision document
 *
 * Display mode: renders vision content as formatted markdown with an Edit button.
 * Edit mode: textarea with Save/Cancel buttons.
 * Empty state: shows an "Add Vision Document" button to enter edit mode.
 */

import { FileText, Pencil } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Markdown } from "@/features/dashboard/components/Markdown";
import type { VisionDocument as VisionDocumentType } from "@/shared/schemas/roadmap";

// =============================================================================
// Props
// =============================================================================

interface VisionDocumentProps {
	vision?: VisionDocumentType;
	onUpdateVision: (content: string) => Promise<void>;
}

// =============================================================================
// Component
// =============================================================================

export function VisionDocument({
	vision,
	onUpdateVision,
}: VisionDocumentProps) {
	const [isEditing, setIsEditing] = useState(false);
	const [editContent, setEditContent] = useState("");
	const [isSaving, setIsSaving] = useState(false);
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	const handleEdit = useCallback(() => {
		setEditContent(vision?.content ?? "");
		setIsEditing(true);
		setTimeout(() => textareaRef.current?.focus(), 0);
	}, [vision]);

	const handleCancel = useCallback(() => {
		setIsEditing(false);
		setEditContent("");
	}, []);

	const handleSave = useCallback(async () => {
		const trimmed = editContent.trim();
		if (!trimmed) return;

		setIsSaving(true);
		try {
			await onUpdateVision(trimmed);
			setIsEditing(false);
			setEditContent("");
		} catch (error) {
			console.error("Failed to save vision document:", error);
		} finally {
			setIsSaving(false);
		}
	}, [editContent, onUpdateVision]);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "Escape") {
				handleCancel();
			}
			// Cmd/Ctrl+Enter to save
			if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				handleSave();
			}
		},
		[handleCancel, handleSave],
	);

	// Edit mode
	if (isEditing) {
		return (
			<div className="flex flex-col gap-3 h-full">
				<div className="flex items-center justify-between">
					<h3 className="text-sm font-medium text-muted-foreground">
						Edit Vision Document
					</h3>
					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={handleCancel}
							disabled={isSaving}
						>
							Cancel
						</Button>
						<Button
							size="sm"
							onClick={handleSave}
							disabled={isSaving || !editContent.trim()}
						>
							{isSaving ? "Saving..." : "Save"}
						</Button>
					</div>
				</div>
				<Textarea
					ref={textareaRef}
					value={editContent}
					onChange={(e) => setEditContent(e.target.value)}
					onKeyDown={handleKeyDown}
					placeholder="Write your product vision in markdown..."
					className="flex-1 min-h-[200px] font-mono text-sm"
				/>
				<p className="text-xs text-muted-foreground">
					Supports markdown formatting. Press{" "}
					<kbd className="px-1 py-0.5 rounded bg-muted text-xs">⌘Enter</kbd> to
					save, <kbd className="px-1 py-0.5 rounded bg-muted text-xs">Esc</kbd>{" "}
					to cancel.
				</p>
			</div>
		);
	}

	// Empty state
	if (!vision?.content) {
		return (
			<div className="flex flex-col items-center justify-center h-full py-12">
				<div className="flex items-center justify-center size-12 rounded-lg bg-muted mb-4">
					<FileText className="size-6 text-muted-foreground" />
				</div>
				<h3 className="text-sm font-medium mb-1">No Vision Document</h3>
				<p className="text-sm text-muted-foreground mb-4 text-center max-w-sm">
					Add a vision document to capture your product direction, goals, and
					strategy.
				</p>
				<Button variant="outline" size="sm" onClick={handleEdit}>
					<FileText className="size-4 mr-1.5" />
					Add Vision Document
				</Button>
			</div>
		);
	}

	// Display mode
	return (
		<div className="flex flex-col gap-3 h-full">
			<div className="flex items-center justify-end">
				<Button variant="ghost" size="sm" onClick={handleEdit}>
					<Pencil className="size-3.5 mr-1.5" />
					Edit
				</Button>
			</div>
			<div className="flex-1 overflow-auto">
				<Markdown>{vision.content}</Markdown>
			</div>
		</div>
	);
}
