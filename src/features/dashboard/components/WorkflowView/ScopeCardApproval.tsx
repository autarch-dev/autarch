/**
 * ScopeCardApproval - Display and approve/deny a pending scope card
 */

import { CheckCircle, ChevronDown, ChevronRight, XCircle } from "lucide-react";
import { useState } from "react";
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
import { cn } from "@/lib/utils";
import type { ScopeCard } from "@/shared/schemas/workflow";

interface ScopeCardApprovalProps {
	scopeCard: ScopeCard;
	onApprove: () => Promise<void>;
	onDeny: (feedback: string) => Promise<void>;
}

export function ScopeCardApproval({
	scopeCard,
	onApprove,
	onDeny,
}: ScopeCardApprovalProps) {
	const [isExpanded, setIsExpanded] = useState(true);
	const [denyDialogOpen, setDenyDialogOpen] = useState(false);
	const [feedback, setFeedback] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);

	const handleApprove = async () => {
		setIsSubmitting(true);
		try {
			await onApprove();
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleDeny = async () => {
		if (!feedback.trim()) return;
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
			<Card className="mx-4 my-4 border-primary/50 bg-primary/5">
				<CardHeader className="pb-2">
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
							<CardTitle className="text-lg">Scope Card: {scopeCard.title}</CardTitle>
						</div>
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
					</div>
				</CardHeader>

				{isExpanded && (
					<CardContent className="space-y-4">
						{/* Description */}
						<div>
							<h4 className="text-sm font-medium text-muted-foreground mb-1">
								Description
							</h4>
							<p className="text-sm">{scopeCard.description}</p>
						</div>

						{/* In Scope */}
						<div>
							<h4 className="text-sm font-medium text-muted-foreground mb-1">
								In Scope
							</h4>
							<ul className="list-disc list-inside text-sm space-y-1">
								{scopeCard.inScope.map((item) => (
									<li key={`in-${item}`} className="text-foreground">
										{item}
									</li>
								))}
							</ul>
						</div>

						{/* Out of Scope */}
						<div>
							<h4 className="text-sm font-medium text-muted-foreground mb-1">
								Out of Scope
							</h4>
							<ul className="list-disc list-inside text-sm space-y-1">
								{scopeCard.outOfScope.map((item) => (
									<li key={`out-${item}`} className="text-foreground">
										{item}
									</li>
								))}
							</ul>
						</div>

						{/* Constraints */}
						{scopeCard.constraints && scopeCard.constraints.length > 0 && (
							<div>
								<h4 className="text-sm font-medium text-muted-foreground mb-1">
									Constraints
								</h4>
								<ul className="list-disc list-inside text-sm space-y-1">
									{scopeCard.constraints.map((item) => (
										<li key={`const-${item}`} className="text-foreground">
											{item}
										</li>
									))}
								</ul>
							</div>
						)}

						{/* Recommended Path */}
						<div>
							<h4 className="text-sm font-medium text-muted-foreground mb-1">
								Recommended Path
							</h4>
							<div className="flex items-center gap-2">
								<span
									className={cn(
										"px-2 py-0.5 rounded text-xs font-medium",
										scopeCard.recommendedPath === "quick"
											? "bg-green-500/10 text-green-700 dark:text-green-400"
											: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
									)}
								>
									{scopeCard.recommendedPath === "quick" ? "Quick Path" : "Full Path"}
								</span>
								{scopeCard.rationale && (
									<span className="text-sm text-muted-foreground">
										— {scopeCard.rationale}
									</span>
								)}
							</div>
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
		</>
	);
}
