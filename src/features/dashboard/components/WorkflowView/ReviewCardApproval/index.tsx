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
	MessageSquare,
	RotateCcw,
	XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { MergeStrategy, ReviewCard } from "@/shared/schemas/workflow";
import { Markdown } from "../../Markdown";
import { reviewCardToMarkdown } from "../artifactMarkdown";
import { CommentSection, groupCommentsByType } from "./CommentSection";
import {
	ApproveDialog,
	RequestFixesDialog,
	RewindDialog,
} from "./ReviewDialogs";

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

export default function ReviewCardApproval({
	reviewCard,
	onApprove,
	onDeny,
	onRewind,
	onRequestFixes,
}: ReviewCardApprovalProps) {
	const [, setLocation] = useLocation();
	// Non-pending cards start collapsed
	const [isExpanded, setIsExpanded] = useState(reviewCard.status === "pending");
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
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [copied, setCopied] = useState(false);

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
			<Card className={cn("my-3", STATUS_STYLES[reviewCard.status])}>
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
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										variant="ghost"
										size="icon-sm"
										className="text-muted-foreground hover:text-foreground"
										onClick={() =>
											setLocation(
												`/workflow/${reviewCard.workflowId}/review/${reviewCard.id}/diff`,
											)
										}
									>
										<GitCompareArrows className="size-4" />
									</Button>
								</TooltipTrigger>
								<TooltipContent>Open full diff workspace</TooltipContent>
							</Tooltip>
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
										disabled={
											isSubmitting ||
											(selectedCount === 0 && !fixesSummary.trim())
										}
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

						<div className="rounded-lg border bg-muted/20 px-3 py-2">
							<p className="text-sm text-muted-foreground">
								Open the dedicated diff workspace to review one file at a time
								and leave inline comments without UI lag.
							</p>
						</div>

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

			{/* Rerun Review Confirmation Dialog */}
			<RewindDialog
				open={rewindDialogOpen}
				onOpenChange={setRewindDialogOpen}
				onSubmit={handleRewind}
				isSubmitting={isSubmitting}
			/>

			{/* Request Fixes Dialog */}
			<RequestFixesDialog
				open={requestFixesDialogOpen}
				onOpenChange={setRequestFixesDialogOpen}
				selectedCount={selectedCount}
				fixesSummary={fixesSummary}
				onFixesSummaryChange={setFixesSummary}
				onSubmit={handleRequestFixes}
				isSubmitting={isSubmitting}
				selectedCommentIds={selectedCommentIds}
			/>

			{/* Approve and Merge Dialog */}
			<ApproveDialog
				open={approveDialogOpen}
				onOpenChange={(open) => {
					setApproveDialogOpen(open);
					// Clear stale error message when dialog closes
					if (!open) {
						setMergeErrorMessage(null);
					}
				}}
				selectedStrategy={selectedStrategy}
				onStrategyChange={setSelectedStrategy}
				commitMessage={commitMessage}
				onCommitMessageChange={setCommitMessage}
				mergeErrorMessage={mergeErrorMessage}
				onSubmit={handleApproveAndMerge}
				isSubmitting={isSubmitting}
				isFetchingDefault={isFetchingDefault}
			/>
		</>
	);
}
