/**
 * ResearchCardApproval - Display and approve/deny a pending research card
 */
/** biome-ignore-all lint/suspicious/noArrayIndexKey: Shruggers. */

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
import type { ResearchCard } from "@/shared/schemas/workflow";

interface ResearchCardApprovalProps {
	researchCard: ResearchCard;
	onApprove: () => Promise<void>;
	onDeny: (feedback: string) => Promise<void>;
}

export function ResearchCardApproval({
	researchCard,
	onApprove,
	onDeny,
}: ResearchCardApprovalProps) {
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
							<CardTitle className="text-lg">Research Findings</CardTitle>
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
						{/* Summary */}
						<div>
							<h4 className="text-sm font-medium text-muted-foreground mb-1">
								Summary
							</h4>
							<p className="text-sm">{researchCard.summary}</p>
						</div>

						{/* Key Files */}
						<div>
							<h4 className="text-sm font-medium text-muted-foreground mb-2">
								Key Files
							</h4>
							<div className="space-y-2">
								{researchCard.keyFiles.map((file) => (
									<div
										key={file.path}
										className="text-sm border rounded-md p-2 bg-muted/30"
									>
										<code className="font-mono text-xs text-primary">
											{file.path}
										</code>
										{file.lineRanges && (
											<span className="text-muted-foreground text-xs ml-2">
												(lines {file.lineRanges})
											</span>
										)}
										<p className="text-muted-foreground mt-1">{file.purpose}</p>
									</div>
								))}
							</div>
						</div>

						{/* Patterns */}
						{researchCard.patterns && researchCard.patterns.length > 0 && (
							<div>
								<h4 className="text-sm font-medium text-muted-foreground mb-2">
									Observed Patterns
								</h4>
								<div className="space-y-3">
									{researchCard.patterns.map((pattern, idx) => (
										<div
											key={`pattern-${idx}`}
											className="text-sm border rounded-md p-2 bg-muted/30"
										>
											<div className="flex items-center gap-2 mb-1">
												<span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-500/10 text-blue-700 dark:text-blue-400">
													{pattern.category}
												</span>
											</div>
											<p className="text-foreground">{pattern.description}</p>
											<p className="text-muted-foreground mt-1 italic">
												{pattern.example}
											</p>
											<div className="mt-1 text-xs text-muted-foreground">
												Found in:{" "}
												{pattern.locations.map((loc, i) => (
													<span key={loc}>
														<code className="font-mono">{loc}</code>
														{i < pattern.locations.length - 1 && ", "}
													</span>
												))}
											</div>
										</div>
									))}
								</div>
							</div>
						)}

						{/* Dependencies */}
						{researchCard.dependencies &&
							researchCard.dependencies.length > 0 && (
								<div>
									<h4 className="text-sm font-medium text-muted-foreground mb-2">
										Dependencies
									</h4>
									<div className="space-y-2">
										{researchCard.dependencies.map((dep) => (
											<div
												key={dep.name}
												className="text-sm border rounded-md p-2 bg-muted/30"
											>
												<code className="font-mono text-xs text-primary">
													{dep.name}
												</code>
												<p className="text-muted-foreground mt-1">
													{dep.purpose}
												</p>
												<p className="text-xs text-muted-foreground mt-1 italic">
													Usage: {dep.usageExample}
												</p>
											</div>
										))}
									</div>
								</div>
							)}

						{/* Integration Points */}
						{researchCard.integrationPoints &&
							researchCard.integrationPoints.length > 0 && (
								<div>
									<h4 className="text-sm font-medium text-muted-foreground mb-2">
										Integration Points
									</h4>
									<div className="space-y-2">
										{researchCard.integrationPoints.map((point, idx) => (
											<div
												key={`integration-${idx}`}
												className="text-sm border rounded-md p-2 bg-muted/30"
											>
												<code className="font-mono text-xs text-primary">
													{point.location}
												</code>
												<p className="text-muted-foreground mt-1">
													{point.description}
												</p>
												<p className="text-xs text-muted-foreground mt-1">
													See:{" "}
													<code className="font-mono">
														{point.existingCode}
													</code>
												</p>
											</div>
										))}
									</div>
								</div>
							)}

						{/* Challenges */}
						{researchCard.challenges && researchCard.challenges.length > 0 && (
							<div>
								<h4 className="text-sm font-medium text-muted-foreground mb-2">
									Challenges & Risks
								</h4>
								<div className="space-y-2">
									{researchCard.challenges.map((challenge, idx) => (
										<div
											key={`challenge-${idx}`}
											className="text-sm border rounded-md p-2 bg-amber-500/5 border-amber-500/20"
										>
											<p className="text-foreground font-medium">
												{challenge.issue}
											</p>
											<p className="text-muted-foreground mt-1">
												<span className="text-green-600 dark:text-green-400 font-medium">
													Mitigation:
												</span>{" "}
												{challenge.mitigation}
											</p>
										</div>
									))}
								</div>
							</div>
						)}

						{/* Recommendations */}
						<div>
							<h4 className="text-sm font-medium text-muted-foreground mb-1">
								Recommendations
							</h4>
							<ul className="list-disc list-inside text-sm space-y-1">
								{researchCard.recommendations.map((rec, idx) => (
									<li key={`rec-${idx}`} className="text-foreground">
										{rec}
									</li>
								))}
							</ul>
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
							Provide feedback for the research agent to continue investigation.
						</DialogDescription>
					</DialogHeader>
					<div className="py-4">
						<Textarea
							value={feedback}
							onChange={(e) => setFeedback(e.target.value)}
							placeholder="e.g., Please also investigate the authentication flow..."
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
