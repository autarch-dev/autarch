/**
 * PlanCardApproval - Display and approve/deny a pending execution plan
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
import type { Plan, PulseDefinition } from "@/shared/schemas/workflow";

interface PlanCardApprovalProps {
	plan: Plan;
	onApprove: () => Promise<void>;
	onDeny: (feedback: string) => Promise<void>;
}

/**
 * Get the style classes for a pulse size badge
 */
function getSizeBadgeClasses(size: PulseDefinition["estimatedSize"]): string {
	switch (size) {
		case "small":
			return "bg-green-500/10 text-green-700 dark:text-green-400";
		case "medium":
			return "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400";
		case "large":
			return "bg-red-500/10 text-red-700 dark:text-red-400";
		default:
			return "bg-muted text-muted-foreground";
	}
}

export function PlanCardApproval({
	plan,
	onApprove,
	onDeny,
}: PlanCardApprovalProps) {
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
				<CardHeader>
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
							<CardTitle className="text-lg">Execution Plan</CardTitle>
							<span className="text-sm text-muted-foreground">
								({plan.pulses.length} pulse{plan.pulses.length !== 1 ? "s" : ""}
								)
							</span>
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
							<Button size="sm" onClick={handleApprove} disabled={isSubmitting}>
								<CheckCircle className="size-4 mr-1" />
								Approve
							</Button>
						</div>
					</div>
				</CardHeader>

				{isExpanded && (
					<CardContent className="space-y-6">
						{/* Approach Summary */}
						<div>
							<h4 className="text-sm font-medium text-muted-foreground mb-1">
								Approach
							</h4>
							<p className="text-sm">{plan.approachSummary}</p>
						</div>

						{/* Pulses */}
						<div>
							<h4 className="text-sm font-medium text-muted-foreground mb-3">
								Execution Pulses
							</h4>
							<div className="space-y-3">
								{plan.pulses.map((pulse, idx) => (
									<div
										key={pulse.id}
										className="border rounded-md p-3 bg-muted/30"
									>
										<div className="flex items-start justify-between gap-2 mb-2">
											<div className="flex items-center gap-2">
												<span className="flex items-center justify-center size-6 rounded-full bg-primary/10 text-primary text-xs font-medium">
													{idx + 1}
												</span>
												<span className="font-medium text-sm">
													{pulse.title}
												</span>
											</div>
											<span
												className={cn(
													"px-2 py-0.5 rounded text-xs font-medium shrink-0",
													getSizeBadgeClasses(pulse.estimatedSize),
												)}
											>
												{pulse.estimatedSize}
											</span>
										</div>

										<p className="text-sm text-muted-foreground mb-2">
											{pulse.description}
										</p>

										{/* Expected Changes */}
										<div className="text-xs">
											<span className="text-muted-foreground">Files: </span>
											{pulse.expectedChanges.map((file, i) => (
												<span key={file}>
													<code className="font-mono text-primary bg-primary/5 px-1 rounded">
														{file}
													</code>
													{i < pulse.expectedChanges.length - 1 && ", "}
												</span>
											))}
										</div>

										{/* Dependencies */}
										{pulse.dependsOn && pulse.dependsOn.length > 0 && (
											<div className="text-xs mt-1">
												<span className="text-muted-foreground">
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
		</>
	);
}
