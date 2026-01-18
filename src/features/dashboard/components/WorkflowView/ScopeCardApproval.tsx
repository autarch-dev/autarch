/**
 * ScopeCardApproval - Display a scope card with status-based styling
 *
 * Shows pending cards with approval buttons, and approved/denied cards
 * in a collapsed read-only state with status badges.
 */

import {
	AlertTriangle,
	CheckCircle,
	ChevronDown,
	ChevronRight,
	CircleDot,
	ClipboardCheck,
	ClipboardCopy,
	ListChecks,
	ListX,
	RotateCcw,
	Target,
	XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import type { ScopeCard } from "@/shared/schemas/workflow";
import { scopeCardToMarkdown } from "./artifactMarkdown";

interface ScopeCardApprovalProps {
	scopeCard: ScopeCard;
	onApprove?: () => Promise<void>;
	onDeny?: (feedback: string) => Promise<void>;
	onRewind?: () => Promise<void>;
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

export function ScopeCardApproval({
	scopeCard,
	onApprove,
	onDeny,
	onRewind,
}: ScopeCardApprovalProps) {
	// Non-pending cards start collapsed
	const [isExpanded, setIsExpanded] = useState(scopeCard.status === "pending");
	const [denyDialogOpen, setDenyDialogOpen] = useState(false);

	// Collapse when status changes from pending
	useEffect(() => {
		if (scopeCard.status !== "pending") {
			setIsExpanded(false);
		}
	}, [scopeCard.status]);
	const [rewindDialogOpen, setRewindDialogOpen] = useState(false);
	const [feedback, setFeedback] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [copied, setCopied] = useState(false);

	const isPending = scopeCard.status === "pending";
	const isApproved = scopeCard.status === "approved";
	const canApprove = isPending && onApprove && onDeny;
	const canRewind = isApproved && onRewind;

	const handleCopyMarkdown = async () => {
		const markdown = scopeCardToMarkdown(scopeCard);
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

	return (
		<>
			<Card className={cn("mx-4 my-4", STATUS_STYLES[scopeCard.status])}>
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
							<Target className="size-5 text-primary" />
							<CardTitle className="text-lg">
								Scope: {scopeCard.title}
							</CardTitle>
							{STATUS_BADGES[scopeCard.status]}
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
									<TooltipContent>Rewind to Research</TooltipContent>
								</Tooltip>
							)}
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
					<CardContent className="space-y-5 pt-0">
						{/* Description */}
						<div>
							<p className="text-sm text-muted-foreground">
								{scopeCard.description}
							</p>
						</div>

						{/* In Scope */}
						<div className="space-y-2">
							<div className="flex items-center gap-2 text-sm font-medium text-green-600 dark:text-green-400">
								<ListChecks className="size-4" />
								In Scope
							</div>
							<ul className="space-y-1.5 pl-6">
								{scopeCard.inScope.map((item) => (
									<li
										key={`in-${item}`}
										className="text-sm flex items-start gap-2"
									>
										<CheckCircle className="size-3.5 text-green-500 mt-0.5 shrink-0" />
										<span>{item}</span>
									</li>
								))}
							</ul>
						</div>

						{/* Out of Scope */}
						<div className="space-y-2">
							<div className="flex items-center gap-2 text-sm font-medium text-red-600 dark:text-red-400">
								<ListX className="size-4" />
								Out of Scope
							</div>
							<ul className="space-y-1.5 pl-6">
								{scopeCard.outOfScope.map((item) => (
									<li
										key={`out-${item}`}
										className="text-sm flex items-start gap-2"
									>
										<XCircle className="size-3.5 text-red-500 mt-0.5 shrink-0" />
										<span className="text-muted-foreground">{item}</span>
									</li>
								))}
							</ul>
						</div>

						{/* Constraints */}
						{scopeCard.constraints && scopeCard.constraints.length > 0 && (
							<div className="space-y-2">
								<div className="flex items-center gap-2 text-sm font-medium text-amber-600 dark:text-amber-400">
									<AlertTriangle className="size-4" />
									Constraints
								</div>
								<ul className="space-y-1.5 pl-6">
									{scopeCard.constraints.map((item) => (
										<li
											key={`const-${item}`}
											className="text-sm flex items-start gap-2"
										>
											<CircleDot className="size-3.5 text-amber-500 mt-0.5 shrink-0" />
											<span>{item}</span>
										</li>
									))}
								</ul>
							</div>
						)}

						{/* Recommended Path */}
						<div className="flex items-center gap-3 pt-2 border-t">
							<span className="text-sm font-medium text-muted-foreground">
								Recommended Path:
							</span>
							<Badge
								variant="outline"
								className={cn(
									scopeCard.recommendedPath === "quick"
										? "text-green-600 border-green-500/50 bg-green-500/10"
										: "text-blue-600 border-blue-500/50 bg-blue-500/10",
								)}
							>
								{scopeCard.recommendedPath === "quick"
									? "Quick Path"
									: "Full Path"}
							</Badge>
							{scopeCard.rationale && (
								<span className="text-sm text-muted-foreground">
									{scopeCard.rationale}
								</span>
							)}
						</div>
					</CardContent>
				)}
			</Card>

			{/* Deny Dialog */}
			<Dialog open={denyDialogOpen} onOpenChange={setDenyDialogOpen}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Request Changes</DialogTitle>
						<DialogDescription>
							Provide feedback for the scoping agent to revise the scope card.
						</DialogDescription>
					</DialogHeader>
					<div className="py-4">
						<Textarea
							value={feedback}
							onChange={(e) => setFeedback(e.target.value)}
							placeholder="e.g., Please also include user notification preferences..."
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

			{/* Rewind Confirmation Dialog */}
			<Dialog open={rewindDialogOpen} onOpenChange={setRewindDialogOpen}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Rewind to Research</DialogTitle>
						<DialogDescription>
							This will discard all research findings, plans, and execution
							progress. The workflow will restart from the research phase using
							this scope.
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
							Rewind
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
