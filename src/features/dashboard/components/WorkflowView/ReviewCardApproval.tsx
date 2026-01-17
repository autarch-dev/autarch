/**
 * ReviewCardApproval - Display a review card with status-based styling
 *
 * Shows pending reviews with approval buttons, and approved/denied reviews
 * in a collapsed read-only state with status badges. Comments are grouped
 * by type (line, file, review) in collapsible sections.
 */

import {
	AlertTriangle,
	CheckCircle,
	ChevronDown,
	ChevronRight,
	ClipboardCheck,
	ClipboardCopy,
	Eye,
	FileText,
	MessageSquare,
	XCircle,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type {
	ReviewCard,
	ReviewComment,
	ReviewCommentSeverity,
} from "@/shared/schemas/workflow";
import { reviewCardToMarkdown } from "./artifactMarkdown";

interface ReviewCardApprovalProps {
	reviewCard: ReviewCard;
	onApprove?: () => Promise<void>;
	onDeny?: (feedback: string) => Promise<void>;
}

const STATUS_STYLES = {
	pending: "border-primary/50 bg-primary/5",
	approved: "border-green-500/30 bg-green-500/5",
	denied: "border-red-500/30 bg-red-500/5",
} as const;

const STATUS_BADGES = {
	pending: null,
	approved: (
		<Badge variant="outline" className="text-green-600 border-green-500/50">
			<CheckCircle className="size-3 mr-1" />
			Approved
		</Badge>
	),
	denied: (
		<Badge variant="outline" className="text-red-600 border-red-500/50">
			<XCircle className="size-3 mr-1" />
			Denied
		</Badge>
	),
} as const;

const RECOMMENDATION_BADGES = {
	approve: (
		<Badge
			variant="outline"
			className="text-green-600 border-green-500/50 bg-green-500/10"
		>
			<CheckCircle className="size-3 mr-1" />
			Approve
		</Badge>
	),
	deny: (
		<Badge
			variant="outline"
			className="text-red-600 border-red-500/50 bg-red-500/10"
		>
			<XCircle className="size-3 mr-1" />
			Deny
		</Badge>
	),
	manual_review: (
		<Badge
			variant="outline"
			className="text-amber-600 border-amber-500/50 bg-amber-500/10"
		>
			<AlertTriangle className="size-3 mr-1" />
			Manual Review
		</Badge>
	),
} as const;

const SEVERITY_STYLES: Record<ReviewCommentSeverity, string> = {
	High: "text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/30",
	Medium:
		"text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/30",
	Low: "text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/30",
};

/**
 * Group comments by type
 */
function groupCommentsByType(comments: ReviewComment[]) {
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

/**
 * Render a single comment item
 */
function CommentItem({ comment }: { comment: ReviewComment }) {
	const locationInfo =
		comment.type === "line" && comment.filePath
			? `${comment.filePath}:${comment.startLine}${comment.endLine && comment.endLine !== comment.startLine ? `-${comment.endLine}` : ""}`
			: comment.type === "file" && comment.filePath
				? comment.filePath
				: null;

	return (
		<div className="border rounded-lg p-3 bg-background">
			<div className="flex items-start justify-between gap-2 mb-2">
				<div className="flex items-center gap-2 flex-wrap">
					<Badge
						variant="outline"
						className={cn("text-xs", SEVERITY_STYLES[comment.severity])}
					>
						{comment.severity}
					</Badge>
					<Badge variant="secondary" className="text-xs">
						{comment.category}
					</Badge>
				</div>
			</div>

			{locationInfo && (
				<div className="mb-2">
					<code className="text-xs font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded">
						{locationInfo}
					</code>
				</div>
			)}

			<p className="text-sm text-muted-foreground">{comment.description}</p>
		</div>
	);
}

/**
 * Collapsible section for a group of comments
 */
function CommentSection({
	title,
	icon: Icon,
	comments,
	defaultOpen = true,
}: {
	title: string;
	icon: React.ElementType;
	comments: ReviewComment[];
	defaultOpen?: boolean;
}) {
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
					<CommentItem key={comment.id} comment={comment} />
				))}
			</CollapsibleContent>
		</Collapsible>
	);
}

export function ReviewCardApproval({
	reviewCard,
	onApprove,
	onDeny,
}: ReviewCardApprovalProps) {
	// Non-pending cards start collapsed
	const [isExpanded, setIsExpanded] = useState(reviewCard.status === "pending");
	const [denyDialogOpen, setDenyDialogOpen] = useState(false);
	const [feedback, setFeedback] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [copied, setCopied] = useState(false);

	const isPending = reviewCard.status === "pending";
	const canApprove = isPending && onApprove && onDeny;

	const { lineComments, fileComments, reviewComments } = groupCommentsByType(
		reviewCard.comments,
	);

	const totalComments = reviewCard.comments.length;

	const handleCopyMarkdown = async () => {
		const markdown = reviewCardToMarkdown(reviewCard);
		await navigator.clipboard.writeText(markdown);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	const handleApprove = async () => {
		if (!onApprove) return;
		setIsSubmitting(true);
		try {
			await onApprove();
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleDeny = async () => {
		if (!feedback.trim() || !onDeny) return;
		setIsSubmitting(true);
		try {
			await onDeny(feedback.trim());
			setDenyDialogOpen(false);
			setFeedback("");
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<>
			<Card className={cn("mx-4 my-4", STATUS_STYLES[reviewCard.status])}>
				<CardHeader className="pb-3">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<Button
								variant="ghost"
								size="icon-sm"
								onClick={() => setIsExpanded(!isExpanded)}
							>
								{isExpanded ? (
									<ChevronDown className="size-4" />
								) : (
									<ChevronRight className="size-4" />
								)}
							</Button>
							<Eye className="size-5 text-primary" />
							<CardTitle className="text-lg">Code Review</CardTitle>
							{totalComments > 0 && (
								<Badge variant="secondary" className="text-xs">
									{totalComments} comment{totalComments !== 1 ? "s" : ""}
								</Badge>
							)}
							{reviewCard.recommendation &&
								RECOMMENDATION_BADGES[reviewCard.recommendation]}
							{STATUS_BADGES[reviewCard.status]}
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										variant="ghost"
										size="icon-sm"
										onClick={handleCopyMarkdown}
										className="text-muted-foreground hover:text-foreground"
									>
										{copied ? (
											<ClipboardCheck className="size-4 text-green-500" />
										) : (
											<ClipboardCopy className="size-4" />
										)}
									</Button>
								</TooltipTrigger>
								<TooltipContent>
									{copied ? "Copied!" : "Copy as Markdown"}
								</TooltipContent>
							</Tooltip>
						</div>
						{canApprove && (
							<div className="flex items-center gap-2">
								<Button
									variant="outline"
									size="sm"
									onClick={() => setDenyDialogOpen(true)}
									disabled={isSubmitting}
									className="text-destructive hover:text-destructive"
								>
									<XCircle className="size-4 mr-1" />
									Request Changes
								</Button>
								<Button
									size="sm"
									onClick={handleApprove}
									disabled={isSubmitting}
								>
									<CheckCircle className="size-4 mr-1" />
									Approve
								</Button>
							</div>
						)}
					</div>
				</CardHeader>

				{isExpanded && (
					<CardContent className="space-y-4 pt-0">
						{/* Summary */}
						{reviewCard.summary && (
							<div className="bg-muted/30 rounded-lg p-3 border">
								<p className="text-sm">{reviewCard.summary}</p>
							</div>
						)}

						{/* Comments grouped by type */}
						{totalComments > 0 ? (
							<div className="space-y-2">
								<CommentSection
									title="Line Comments"
									icon={MessageSquare}
									comments={lineComments}
								/>
								<CommentSection
									title="File Comments"
									icon={FileText}
									comments={fileComments}
								/>
								<CommentSection
									title="Review Comments"
									icon={Eye}
									comments={reviewComments}
								/>
							</div>
						) : (
							<div className="text-sm text-muted-foreground text-center py-4">
								No comments yet
							</div>
						)}
					</CardContent>
				)}
			</Card>

			{/* Deny Dialog */}
			<Dialog open={denyDialogOpen} onOpenChange={setDenyDialogOpen}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Request Changes</DialogTitle>
						<DialogDescription>
							Provide feedback for the review to be revised.
						</DialogDescription>
					</DialogHeader>
					<div className="py-4">
						<Textarea
							value={feedback}
							onChange={(e) => setFeedback(e.target.value)}
							placeholder="e.g., Please review the error handling more thoroughly..."
							rows={4}
							autoFocus
						/>
					</div>
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => setDenyDialogOpen(false)}
							disabled={isSubmitting}
						>
							Cancel
						</Button>
						<Button
							onClick={handleDeny}
							disabled={isSubmitting || !feedback.trim()}
						>
							Submit Feedback
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
