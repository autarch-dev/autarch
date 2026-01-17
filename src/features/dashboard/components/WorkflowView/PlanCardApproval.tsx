/**
 * PlanCardApproval - Display an execution plan with status-based styling
 *
 * Shows pending plans with approval buttons, and approved/denied plans
 * in a collapsed read-only state with status badges.
 */

import {
	CheckCircle,
	ChevronDown,
	ChevronRight,
	ClipboardCheck,
	ClipboardCopy,
	ClipboardList,
	RotateCcw,
	XCircle,
} from "lucide-react";
import { useState } from "react";
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
import type { Plan, PulseDefinition } from "@/shared/schemas/workflow";
import { planToMarkdown } from "./artifactMarkdown";

interface PlanCardApprovalProps {
	plan: Plan;
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

/**
 * Get the style classes for a pulse size badge
 */
function getSizeBadgeClasses(size: PulseDefinition["estimatedSize"]): string {
	switch (size) {
		case "small":
			return "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30";
		case "medium":
			return "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30";
		case "large":
			return "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30";
		default:
			return "bg-muted text-muted-foreground";
	}
}

export function PlanCardApproval({
	plan,
	onApprove,
	onDeny,
	onRewind,
}: PlanCardApprovalProps) {
	// Non-pending cards start collapsed
	const [isExpanded, setIsExpanded] = useState(plan.status === "pending");
	const [denyDialogOpen, setDenyDialogOpen] = useState(false);
	const [rewindDialogOpen, setRewindDialogOpen] = useState(false);
	const [feedback, setFeedback] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [copied, setCopied] = useState(false);

	const isPending = plan.status === "pending";
	const isApproved = plan.status === "approved";
	const canApprove = isPending && onApprove && onDeny;
	const canRewind = isApproved && onRewind;

	const handleCopyMarkdown = async () => {
		const markdown = planToMarkdown(plan);
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
			<Card className={cn("mx-4 my-4", STATUS_STYLES[plan.status])}>
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
							<ClipboardList className="size-5 text-primary" />
							<CardTitle className="text-lg">Execution Plan</CardTitle>
							<Badge variant="secondary" className="text-xs">
								{plan.pulses.length} pulse{plan.pulses.length !== 1 ? "s" : ""}
							</Badge>
							{STATUS_BADGES[plan.status]}
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
									<TooltipContent>Rewind Execution</TooltipContent>
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
					<CardContent className="space-y-4 pt-0">
						{/* Approach Summary */}
						<div className="bg-muted/30 rounded-lg p-3 border">
							<p className="text-sm">{plan.approachSummary}</p>
						</div>

						{/* Pulses */}
						<div className="space-y-3">
							{plan.pulses.map((pulse, idx) => (
								<div
									key={pulse.id}
									className="border rounded-lg p-3 bg-background"
								>
									<div className="flex items-start justify-between gap-2 mb-2">
										<div className="flex items-center gap-2">
											<span className="flex items-center justify-center size-6 rounded-full bg-primary/10 text-primary text-xs font-semibold">
												{idx + 1}
											</span>
											<span className="font-medium text-sm">{pulse.title}</span>
										</div>
										<Badge
											variant="outline"
											className={cn(
												"text-xs shrink-0",
												getSizeBadgeClasses(pulse.estimatedSize),
											)}
										>
											{pulse.estimatedSize}
										</Badge>
									</div>

									<p className="text-sm text-muted-foreground mb-3 pl-8">
										{pulse.description}
									</p>

									{/* Expected Changes */}
									<div className="pl-8 text-xs">
										<span className="text-muted-foreground font-medium">
											Files:{" "}
										</span>
										<span className="flex flex-wrap gap-1.5 mt-1">
											{pulse.expectedChanges.map((file) => (
												<code
													key={file}
													className="font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded"
												>
													{file}
												</code>
											))}
										</span>
									</div>

									{/* Dependencies */}
									{pulse.dependsOn && pulse.dependsOn.length > 0 && (
										<div className="pl-8 text-xs mt-2">
											<span className="text-muted-foreground font-medium">
												Depends on:{" "}
											</span>
											{pulse.dependsOn.map((dep, i) => (
												<span key={dep}>
													<code className="font-mono text-amber-600 dark:text-amber-400">
														{dep}
													</code>
													{i < (pulse.dependsOn?.length ?? 0) - 1 && ", "}
												</span>
											))}
										</div>
									)}
								</div>
							))}
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
							Provide feedback for the planning agent to revise the execution
							plan.
						</DialogDescription>
					</DialogHeader>
					<div className="py-4">
						<Textarea
							value={feedback}
							onChange={(e) => setFeedback(e.target.value)}
							placeholder="e.g., Please break down pulse 2 into smaller steps..."
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
						<DialogTitle>Rewind Execution</DialogTitle>
						<DialogDescription>
							This will discard all current progress and restart execution from
							the beginning. All completed pulses and changes will be lost.
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
