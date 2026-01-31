/**
 * CommentSection - Collapsible section for a group of comments with select all/none controls
 */

import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { ReviewComment } from "@/shared/schemas/workflow";
import { CommentItem } from "./CommentItem";

interface CommentSectionProps {
	title: string;
	icon: React.ElementType;
	comments: ReviewComment[];
	defaultOpen?: boolean;
	selectedCommentIds?: Set<string>;
	onToggleComment?: (commentId: string) => void;
}

/**
 * Collapsible section for a group of comments
 */
export function CommentSection({
	title,
	icon: Icon,
	comments,
	defaultOpen = true,
	selectedCommentIds,
	onToggleComment,
}: CommentSectionProps) {
	const [isOpen, setIsOpen] = useState(defaultOpen);

	if (comments.length === 0) return null;

	return (
		<Collapsible open={isOpen} onOpenChange={setIsOpen}>
			<CollapsibleTrigger asChild>
				<Button
					variant="ghost"
					className="w-full justify-start gap-2 p-2 h-auto hover:bg-muted/50"
				>
					{isOpen ? (
						<ChevronDown className="size-4" />
					) : (
						<ChevronRight className="size-4" />
					)}
					<Icon className="size-4 text-primary" />
					<span className="font-medium text-sm">{title}</span>
					<Badge variant="secondary" className="text-xs ml-auto">
						{comments.length}
					</Badge>
				</Button>
			</CollapsibleTrigger>
			<CollapsibleContent className="space-y-2 pl-6 pt-2">
				{comments.map((comment) => (
					<CommentItem
						key={comment.id}
						comment={comment}
						isSelected={selectedCommentIds?.has(comment.id)}
						onToggle={
							onToggleComment ? () => onToggleComment(comment.id) : undefined
						}
					/>
				))}
			</CollapsibleContent>
		</Collapsible>
	);
}

/**
 * Group comments by type
 */
export function groupCommentsByType(comments: ReviewComment[]) {
	const lineComments: ReviewComment[] = [];
	const fileComments: ReviewComment[] = [];
	const reviewComments: ReviewComment[] = [];

	for (const comment of comments) {
		switch (comment.type) {
			case "line":
				lineComments.push(comment);
				break;
			case "file":
				fileComments.push(comment);
				break;
			case "review":
				reviewComments.push(comment);
				break;
		}
	}

	return { lineComments, fileComments, reviewComments };
}
