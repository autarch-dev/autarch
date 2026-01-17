/**
 * ResearchCardApproval - Display a research card with status-based styling
 *
 * Shows pending cards with approval buttons, and approved/denied cards
 * in a collapsed read-only state with status badges.
 * Features collapsible sections for large content areas.
 */
/** biome-ignore-all lint/suspicious/noArrayIndexKey: Shruggers. */

import {
	AlertTriangle,
	CheckCircle,
	ChevronDown,
	ChevronRight,
	ClipboardCheck,
	ClipboardCopy,
	FileCode,
	GitMerge,
	Layers,
	Lightbulb,
	Package,
	Search,
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
import type { ResearchCard } from "@/shared/schemas/workflow";
import { researchCardToMarkdown } from "./artifactMarkdown";

interface ResearchCardApprovalProps {
	researchCard: ResearchCard;
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

interface CollapsibleSectionProps {
	title: string;
	icon: React.ReactNode;
	defaultOpen?: boolean;
	children: React.ReactNode;
	count?: number;
}

function CollapsibleSection({
	title,
	icon,
	defaultOpen = true,
	children,
	count,
}: CollapsibleSectionProps) {
	const [isOpen, setIsOpen] = useState(defaultOpen);

	return (
		<Collapsible open={isOpen} onOpenChange={setIsOpen}>
			<CollapsibleTrigger asChild>
				<button
					type="button"
					className="flex items-center gap-2 w-full text-sm font-medium hover:text-foreground transition-colors py-1"
				>
					{isOpen ? (
						<ChevronDown className="size-4" />
					) : (
						<ChevronRight className="size-4" />
					)}
					{icon}
					<span>{title}</span>
					{count !== undefined && (
						<Badge variant="secondary" className="ml-auto text-xs">
							{count}
						</Badge>
					)}
				</button>
			</CollapsibleTrigger>
			<CollapsibleContent className="pl-6 pt-2">{children}</CollapsibleContent>
		</Collapsible>
	);
}

export function ResearchCardApproval({
	researchCard,
	onApprove,
	onDeny,
}: ResearchCardApprovalProps) {
	// Non-pending cards start collapsed
	const [isExpanded, setIsExpanded] = useState(
		researchCard.status === "pending",
	);
	const [denyDialogOpen, setDenyDialogOpen] = useState(false);
	const [feedback, setFeedback] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [copied, setCopied] = useState(false);

	const isPending = researchCard.status === "pending";
	const canApprove = isPending && onApprove && onDeny;

	const handleCopyMarkdown = async () => {
		const markdown = researchCardToMarkdown(researchCard);
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
			<Card className={cn("mx-4 my-4", STATUS_STYLES[researchCard.status])}>
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
							<Search className="size-5 text-primary" />
							<CardTitle className="text-lg">Research Findings</CardTitle>
							{STATUS_BADGES[researchCard.status]}
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
						<div className="bg-muted/30 rounded-lg p-3 border">
							<p className="text-sm">{researchCard.summary}</p>
						</div>

						{/* Key Files */}
						<CollapsibleSection
							title="Key Files"
							icon={<FileCode className="size-4 text-blue-500" />}
							count={researchCard.keyFiles.length}
						>
							<div className="space-y-2">
								{researchCard.keyFiles.map((file) => (
									<div
										key={file.path}
										className="text-sm border rounded-md p-2.5 bg-background"
									>
										<div className="flex items-center gap-2">
											<code className="font-mono text-xs text-primary bg-primary/10 px-1.5 py-0.5 rounded">
												{file.path}
											</code>
											{file.lineRanges && (
												<span className="text-muted-foreground text-xs">
													L{file.lineRanges}
												</span>
											)}
										</div>
										<p className="text-muted-foreground mt-1.5 text-xs">
											{file.purpose}
										</p>
									</div>
								))}
							</div>
						</CollapsibleSection>

						{/* Patterns */}
						{researchCard.patterns && researchCard.patterns.length > 0 && (
							<CollapsibleSection
								title="Patterns"
								icon={<Layers className="size-4 text-purple-500" />}
								count={researchCard.patterns.length}
								defaultOpen={false}
							>
								<div className="space-y-3">
									{researchCard.patterns.map((pattern, idx) => (
										<div
											key={`pattern-${idx}`}
											className="text-sm border rounded-md p-2.5 bg-background"
										>
											<Badge
												variant="secondary"
												className="mb-2 text-xs bg-purple-500/10 text-purple-700 dark:text-purple-300"
											>
												{pattern.category}
											</Badge>
											<p className="text-foreground">{pattern.description}</p>
											<p className="text-muted-foreground mt-1.5 italic text-xs">
												"{pattern.example}"
											</p>
											<div className="mt-2 text-xs text-muted-foreground">
												<span className="font-medium">Found in: </span>
												{pattern.locations.map((loc, i) => (
													<span key={loc}>
														<code className="font-mono text-primary/80">
															{loc}
														</code>
														{i < pattern.locations.length - 1 && ", "}
													</span>
												))}
											</div>
										</div>
									))}
								</div>
							</CollapsibleSection>
						)}

						{/* Dependencies */}
						{researchCard.dependencies &&
							researchCard.dependencies.length > 0 && (
								<CollapsibleSection
									title="Dependencies"
									icon={<Package className="size-4 text-orange-500" />}
									count={researchCard.dependencies.length}
									defaultOpen={false}
								>
									<div className="space-y-2">
										{researchCard.dependencies.map((dep) => (
											<div
												key={dep.name}
												className="text-sm border rounded-md p-2.5 bg-background"
											>
												<code className="font-mono text-xs text-primary bg-primary/10 px-1.5 py-0.5 rounded">
													{dep.name}
												</code>
												<p className="text-muted-foreground mt-1.5 text-xs">
													{dep.purpose}
												</p>
												<p className="text-xs text-muted-foreground/70 mt-1 font-mono">
													{dep.usageExample}
												</p>
											</div>
										))}
									</div>
								</CollapsibleSection>
							)}

						{/* Integration Points */}
						{researchCard.integrationPoints &&
							researchCard.integrationPoints.length > 0 && (
								<CollapsibleSection
									title="Integration Points"
									icon={<GitMerge className="size-4 text-cyan-500" />}
									count={researchCard.integrationPoints.length}
									defaultOpen={false}
								>
									<div className="space-y-2">
										{researchCard.integrationPoints.map((point, idx) => (
											<div
												key={`integration-${idx}`}
												className="text-sm border rounded-md p-2.5 bg-background"
											>
												<code className="font-mono text-xs text-primary bg-primary/10 px-1.5 py-0.5 rounded">
													{point.location}
												</code>
												<p className="text-muted-foreground mt-1.5 text-xs">
													{point.description}
												</p>
												<p className="text-xs text-muted-foreground/70 mt-1">
													See:{" "}
													<code className="font-mono">{point.existingCode}</code>
												</p>
											</div>
										))}
									</div>
								</CollapsibleSection>
							)}

						{/* Challenges */}
						{researchCard.challenges && researchCard.challenges.length > 0 && (
							<CollapsibleSection
								title="Challenges & Risks"
								icon={<AlertTriangle className="size-4 text-amber-500" />}
								count={researchCard.challenges.length}
							>
								<div className="space-y-2">
									{researchCard.challenges.map((challenge, idx) => (
										<div
											key={`challenge-${idx}`}
											className="text-sm border rounded-md p-2.5 bg-amber-500/5 border-amber-500/20"
										>
											<p className="font-medium text-foreground">
												{challenge.issue}
											</p>
											<p className="text-muted-foreground mt-1.5 text-xs">
												<span className="text-green-600 dark:text-green-400 font-medium">
													Mitigation:
												</span>{" "}
												{challenge.mitigation}
											</p>
										</div>
									))}
								</div>
							</CollapsibleSection>
						)}

						{/* Recommendations */}
						<CollapsibleSection
							title="Recommendations"
							icon={<Lightbulb className="size-4 text-yellow-500" />}
							count={researchCard.recommendations.length}
						>
							<ul className="space-y-1.5">
								{researchCard.recommendations.map((rec, idx) => (
									<li
										key={`rec-${idx}`}
										className="text-sm flex items-start gap-2"
									>
										<CheckCircle className="size-3.5 text-green-500 mt-0.5 shrink-0" />
										<span>{rec}</span>
									</li>
								))}
							</ul>
						</CollapsibleSection>
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
