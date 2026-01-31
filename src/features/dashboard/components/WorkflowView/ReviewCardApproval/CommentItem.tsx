/**
 * CommentItem - Individual comment display with checkbox, severity badge, expand/collapse
 */

import { CheckSquare, Square } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type {
	ReviewComment,
	ReviewCommentSeverity,
} from "@/shared/schemas/workflow";
import { Markdown } from "../../Markdown";

const SEVERITY_STYLES: Record<ReviewCommentSeverity, string> = {
	High: "text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/30",
	Medium:
		"text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/30",
	Low: "text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/30",
};

interface CommentItemProps {
	comment: ReviewComment;
	isSelected?: boolean;
	onToggle?: () => void;
}

/**
 * Render a single comment item
 */
export function CommentItem({
	comment,
	isSelected,
	onToggle,
}: CommentItemProps) {
	const locationInfo =
		comment.type === "line" && comment.filePath
			? `${comment.filePath}:${comment.startLine}${comment.endLine && comment.endLine !== comment.startLine ? `-${comment.endLine}` : ""}`
			: comment.type === "file" && comment.filePath
				? comment.filePath
				: null;

	// User comments (no severity) get a different display
	const isUserComment = comment.author === "user" || !comment.severity;

	return (
		<div
			className={cn(
				"border rounded-lg p-3 bg-background transition-colors",
				isSelected && "bg-primary/10 border-primary/50",
			)}
		>
			<div className="flex items-start justify-between gap-2 mb-2">
				<div className="flex items-center gap-2 flex-wrap">
					{onToggle && (
						<button
							type="button"
							onClick={onToggle}
							className="text-muted-foreground hover:text-foreground transition-colors"
							aria-label={isSelected ? "Deselect comment" : "Select comment"}
						>
							{isSelected ? (
								<CheckSquare className="size-4 text-primary" />
							) : (
								<Square className="size-4" />
							)}
						</button>
					)}
					{isUserComment ? (
						<Badge variant="outline" className="text-xs">
							You
						</Badge>
					) : comment.severity ? (
						<>
							<Badge
								variant="outline"
								className={cn("text-xs", SEVERITY_STYLES[comment.severity])}
							>
								{comment.severity}
							</Badge>
							{comment.category && (
								<Badge variant="secondary" className="text-xs">
									{comment.category}
								</Badge>
							)}
						</>
					) : null}
				</div>
			</div>

			{locationInfo && (
				<div className="mb-2">
					<code className="text-xs font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded">
						{locationInfo}
					</code>
				</div>
			)}

			<Markdown className="text-sm prose-p:text-muted-foreground">
				{comment.description}
			</Markdown>
		</div>
	);
}
