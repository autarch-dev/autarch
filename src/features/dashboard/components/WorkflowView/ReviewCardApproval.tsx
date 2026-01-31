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
	CheckSquare,
	ChevronDown,
	ChevronRight,
	ClipboardCheck,
	ClipboardCopy,
	Eye,
	FileText,
	GitCompareArrows,
	GitMerge,
	Loader2,
	MessageSquare,
	RotateCcw,
	Square,
	XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
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
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type {
	MergeStrategy,
	ReviewCard,
	ReviewComment,
	ReviewCommentSeverity,
} from "@/shared/schemas/workflow";
import { Markdown } from "../Markdown";
import { reviewCardToMarkdown } from "./artifactMarkdown";
import { DiffViewerModal } from "./DiffViewer";

interface MergeOptions {
	mergeStrategy: MergeStrategy;
	commitMessage: string;
}

interface ReviewCardApprovalProps {
	reviewCard: ReviewCard;
	onApprove?: (mergeOptions: MergeOptions) => Promise<void>;
	onDeny?: (feedback: string) => Promise<void>;
	onRewind?: () => Promise<void>;
	onRequestFixes?: (commentIds: string[], summary?: string) => Promise<void>;
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
function CommentItem({
	comment,
	isSelected,
	onToggle,
}: {
	comment: ReviewComment;
	isSelected?: boolean;
	onToggle?: () => void;
}) {
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

/**
 * Collapsible section for a group of comments
 */
function CommentSection({
	title,
	icon: Icon,
	comments,
	defaultOpen = true,
	selectedCommentIds,
	onToggleComment,
}: {
	title: string;
	icon: React.ElementType;
	comments: ReviewComment[];
	defaultOpen?: boolean;
	selectedCommentIds?: Set<string>;
	onToggleComment?: (commentId: string) => void;
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

export function ReviewCardApproval({
	reviewCard,
	onApprove,
	onDeny,
	onRewind,
	onRequestFixes,
}: ReviewCardApprovalProps) {
	// Non-pending cards start collapsed
	const [isExpanded, setIsExpanded] = useState(reviewCard.status === "pending");
	const [denyDialogOpen, setDenyDialogOpen] = useState(false);
	const [rewindDialogOpen, setRewindDialogOpen] = useState(false);
	const [requestFixesDialogOpen, setRequestFixesDialogOpen] = useState(false);
	const [approveDialogOpen, setApproveDialogOpen] = useState(false);
	const [selectedStrategy, setSelectedStrategy] =
		useState<MergeStrategy>("fast-forward");
	const [defaultStrategy, setDefaultStrategy] =
		useState<MergeStrategy>("fast-forward");
	const [isFetchingDefault, setIsFetchingDefault] = useState(true);
	const [commitMessage, setCommitMessage] = useState(
		reviewCard.suggestedCommitMessage ?? "",
	);
	const [mergeErrorMessage, setMergeErrorMessage] = useState<string | null>(
		null,
	);
	const [selectedCommentIds, setSelectedCommentIds] = useState<Set<string>>(
		new Set(),
	);
	const [fixesSummary, setFixesSummary] = useState("");

	// Collapse when status changes from pending
	useEffect(() => {
		if (reviewCard.status !== "pending") {
			setIsExpanded(false);
		}
	}, [reviewCard.status]);

	// Fetch default merge strategy on mount
	useEffect(() => {
		setIsFetchingDefault(true);
		fetch("/api/settings/merge-strategy")
			.then((res) => {
				if (!res.ok) {
					throw new Error("Failed to fetch merge strategy");
				}
				return res.json();
			})
			.then((data) => {
				if (data.strategy) {
					setDefaultStrategy(data.strategy);
					setSelectedStrategy(data.strategy);
				}
			})
			.catch((err) => {
				console.error("Failed to fetch merge strategy preference:", err);
				// Keep 'fast-forward' as fallback (already set as default)
			})
			.finally(() => {
				setIsFetchingDefault(false);
			});
	}, []);
	const [feedback, setFeedback] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [copied, setCopied] = useState(false);
	const [diff, setDiff] = useState<string | null>(null);
	const [isDiffLoading, setIsDiffLoading] = useState(false);

	// Fetch diff when component mounts or expands
	useEffect(() => {
		if (isExpanded && diff === null && !isDiffLoading) {
			setIsDiffLoading(true);
			fetch(`/api/workflows/${reviewCard.workflowId}/diff`)
				.then((res) => res.json())
				.then((data) => {
					setDiff(data.diff ?? "");
				})
				.catch((err) => {
					console.error("Failed to fetch diff:", err);
					setDiff("");
				})
				.finally(() => {
					setIsDiffLoading(false);
				});
		}
	}, [isExpanded, reviewCard.workflowId, diff, isDiffLoading]);

	const isPending = reviewCard.status === "pending";
	const canApprove = isPending && onApprove && onDeny;
	const canRewind = !isPending && onRewind;

	const { lineComments, fileComments, reviewComments } = groupCommentsByType(
		reviewCard.comments,
	);

	const totalComments = reviewCard.comments.length;
	const selectedCount = selectedCommentIds.size;

	const handleToggleComment = (commentId: string) => {
		setSelectedCommentIds((prev) => {
			const next = new Set(prev);
			if (next.has(commentId)) {
				next.delete(commentId);
			} else {
				next.add(commentId);
			}
			return next;
		});
	};

	const handleCopyMarkdown = async () => {
		const markdown = reviewCardToMarkdown(reviewCard);
		await navigator.clipboard.writeText(markdown);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	const handleOpenApproveDialog = () => {
		// Reset state when opening dialog
		setCommitMessage(reviewCard.suggestedCommitMessage ?? "");
		setSelectedStrategy(defaultStrategy);
		setMergeErrorMessage(null);
		setApproveDialogOpen(true);
	};

	const handleApproveAndMerge = async () => {
		if (!onApprove) return;
		setIsSubmitting(true);
		setMergeErrorMessage(null);
		try {
			await onApprove({
				mergeStrategy: selectedStrategy,
				commitMessage: commitMessage.trim(),
			});

			// Save preference if strategy differs from default
			if (selectedStrategy !== defaultStrategy) {
				fetch("/api/settings/merge-strategy", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ strategy: selectedStrategy }),
				}).catch((err) => {
					// Non-blocking - just log if preference save fails
					console.error("Failed to save merge strategy preference:", err);
				});
			}

			setApproveDialogOpen(false);
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : "Merge failed";
			setMergeErrorMessage(errorMsg);
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

	const handleRewind = async () => {
		if (!onRewind) return;
		setIsSubmitting(true);
		try {
			await onRewind();
			setRewindDialogOpen(false);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleRequestFixes = async () => {
		if (selectedCommentIds.size === 0 && !fixesSummary.trim()) return;
		if (!onRequestFixes) return;
		setIsSubmitting(true);
		try {
			await onRequestFixes(
				Array.from(selectedCommentIds),
				fixesSummary.trim() || undefined,
			);
			setRequestFixesDialogOpen(false);
			setFixesSummary("");
			setSelectedCommentIds(new Set());
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<>
			<Card className={cn("mx-4 my-4", STATUS_STYLES[reviewCard.status])}>
				<CardHeader className={cn("pb-3", !isExpanded && "pb-0 -mb-2")}>
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
							{selectedCount > 0 && (
								<Badge
									variant="outline"
									className="text-xs text-primary border-primary/50 bg-primary/10"
								>
									<CheckSquare className="size-3 mr-1" />
									{selectedCount} selected
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
							{diff && diff.trim() !== "" && (
								<Tooltip>
									<TooltipTrigger asChild>
										<span>
											<DiffViewerModal
												diff={diff}
												comments={reviewCard.comments}
												workflowId={reviewCard.workflowId}
												trigger={
													<Button
														variant="ghost"
														size="icon-sm"
														className="text-muted-foreground hover:text-foreground"
													>
														<GitCompareArrows className="size-4" />
													</Button>
												}
											/>
										</span>
									</TooltipTrigger>
									<TooltipContent>View Diff</TooltipContent>
								</Tooltip>
							)}
							{canRewind && (
								<Tooltip>
									<TooltipTrigger asChild>
										<Button
											variant="ghost"
											size="icon-sm"
											onClick={() => setRewindDialogOpen(true)}
											className="text-muted-foreground hover:text-foreground"
										>
											<RotateCcw className="size-4" />
										</Button>
									</TooltipTrigger>
									<TooltipContent>Rerun Review</TooltipContent>
								</Tooltip>
							)}
						</div>
						{canApprove && (
							<div className="flex items-center gap-2">
								{onRequestFixes && (
									<Button
										variant="outline"
										size="sm"
										onClick={() => setRequestFixesDialogOpen(true)}
										disabled={isSubmitting || selectedCount === 0}
										className="text-amber-600 hover:text-amber-600"
									>
										<AlertTriangle className="size-4 mr-1" />
										{selectedCount > 0
											? `Request Fixes (${selectedCount})`
											: "Request Fixes"}
									</Button>
								)}
								<Button
									size="sm"
									onClick={handleOpenApproveDialog}
									disabled={isSubmitting}
								>
									<GitMerge className="size-4 mr-1" />
									Approve and Merge
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
								<Markdown className="text-sm">{reviewCard.summary}</Markdown>
							</div>
						)}

						{/* Comments grouped by type */}
						{totalComments > 0 ? (
							<div className="space-y-2">
								<CommentSection
									title="Line Comments"
									icon={MessageSquare}
									comments={lineComments}
									selectedCommentIds={
										canApprove ? selectedCommentIds : undefined
									}
									onToggleComment={canApprove ? handleToggleComment : undefined}
								/>
								<CommentSection
									title="File Comments"
									icon={FileText}
									comments={fileComments}
									selectedCommentIds={
										canApprove ? selectedCommentIds : undefined
									}
									onToggleComment={canApprove ? handleToggleComment : undefined}
								/>
								<CommentSection
									title="Review Comments"
									icon={Eye}
									comments={reviewComments}
									selectedCommentIds={
										canApprove ? selectedCommentIds : undefined
									}
									onToggleComment={canApprove ? handleToggleComment : undefined}
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

			{/* Rerun Review Confirmation Dialog */}
			<Dialog open={rewindDialogOpen} onOpenChange={setRewindDialogOpen}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Rerun Review</DialogTitle>
						<DialogDescription>
							This will clear all existing review comments and restart the
							review agent. The execution results and changes will be preserved.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => setRewindDialogOpen(false)}
							disabled={isSubmitting}
						>
							Cancel
						</Button>
						<Button
							variant="destructive"
							onClick={handleRewind}
							disabled={isSubmitting}
						>
							<RotateCcw className="size-4 mr-1" />
							Rerun Review
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Request Fixes Dialog */}
			<Dialog
				open={requestFixesDialogOpen}
				onOpenChange={setRequestFixesDialogOpen}
			>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Request Fixes</DialogTitle>
						<DialogDescription>
							{selectedCount} comment{selectedCount !== 1 ? "s" : ""} selected
							to be addressed.
						</DialogDescription>
					</DialogHeader>
					<div className="py-4">
						<Textarea
							value={fixesSummary}
							onChange={(e) => setFixesSummary(e.target.value)}
							placeholder="Optional: Add any additional context or instructions..."
							rows={4}
							autoFocus
						/>
					</div>
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => setRequestFixesDialogOpen(false)}
							disabled={isSubmitting}
						>
							Cancel
						</Button>
						<Button
							onClick={handleRequestFixes}
							disabled={
								isSubmitting ||
								(selectedCommentIds.size === 0 && !fixesSummary.trim())
							}
						>
							Submit
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Approve and Merge Dialog */}
			<Dialog
				open={approveDialogOpen}
				onOpenChange={(open) => {
					setApproveDialogOpen(open);
					// Clear stale error message when dialog closes
					if (!open) {
						setMergeErrorMessage(null);
					}
				}}
			>
				<DialogContent className="sm:max-w-lg">
					<DialogHeader>
						<DialogTitle>Approve and Merge</DialogTitle>
						<DialogDescription>
							Choose a merge strategy and confirm the commit message.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 py-4">
						<div className="space-y-2">
							<Label htmlFor="merge-strategy">Merge Strategy</Label>
							<Select
								value={selectedStrategy}
								onValueChange={(value) =>
									setSelectedStrategy(value as MergeStrategy)
								}
								disabled={isFetchingDefault}
							>
								<SelectTrigger id="merge-strategy">
									{isFetchingDefault ? (
										<span className="flex items-center gap-2">
											<Loader2 className="size-4 animate-spin" />
											Loading...
										</span>
									) : (
										<SelectValue placeholder="Select merge strategy" />
									)}
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="fast-forward">Fast-forward</SelectItem>
									<SelectItem value="squash">Squash</SelectItem>
									<SelectItem value="merge-commit">Merge commit</SelectItem>
									<SelectItem value="rebase">Rebase and merge</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-2">
							<Label htmlFor="commit-message">Commit Message</Label>
							<Textarea
								id="commit-message"
								value={commitMessage}
								onChange={(e) => setCommitMessage(e.target.value)}
								placeholder={
									selectedStrategy === "fast-forward"
										? "Not required for fast-forward merge"
										: "Enter commit message..."
								}
								rows={4}
								disabled={selectedStrategy === "fast-forward"}
							/>
							{selectedStrategy === "fast-forward" && (
								<p className="text-xs text-muted-foreground">
									Fast-forward merges don't create a new commit, so no message
									is needed.
								</p>
							)}
						</div>
						{mergeErrorMessage && (
							<div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
								{mergeErrorMessage}
							</div>
						)}
					</div>
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => setApproveDialogOpen(false)}
							disabled={isSubmitting}
						>
							Cancel
						</Button>
						<Button
							onClick={handleApproveAndMerge}
							disabled={
								isSubmitting ||
								isFetchingDefault ||
								(selectedStrategy !== "fast-forward" && !commitMessage.trim())
							}
						>
							{isSubmitting && <Loader2 className="size-4 mr-1 animate-spin" />}
							<GitMerge className="size-4 mr-1" />
							Approve and Merge
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
