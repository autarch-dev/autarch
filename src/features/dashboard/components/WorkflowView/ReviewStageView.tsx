/**
 * ReviewStageView - Renders the review stage of a workflow
 *
 * Pure presentational component that displays messages with artifact interleaving
 * for the review stage. Filters messages by stage and renders review cards
 * after their associated turn. Shows approved plan as context.
 */

import {
	AlertTriangle,
	CheckCircle,
	ChevronDown,
	ChevronRight,
	Circle,
	Loader2,
	XCircle,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { Plan, ReviewCard } from "@/shared/schemas/workflow";
import { type Subtask, useSubtasks } from "../../store/workflowsStore";
import {
	ChannelMessageBubble,
	StreamingMessageBubble,
} from "../ChannelView/MessageBubble";
import { PlanCardApproval } from "./PlanCardApproval";
import ReviewCardApproval from "./ReviewCardApproval";
import type { StageViewProps } from "./types";

/**
 * Status-based container styling for subtask cards.
 * Maps subtask status to Tailwind border and background classes.
 */
const SUBTASK_CONTAINER_STYLES = {
	pending: "border-gray-300 bg-gray-50/50",
	running: "border-blue-500/50 bg-blue-500/5",
	completed: "border-green-500/30 bg-green-500/5",
	failed: "border-red-500/50 bg-red-500/10",
} as const;

/**
 * Severity color styles for sub-review concern badges.
 * Follows the same pattern as SEVERITY_STYLES in CommentItem.tsx.
 */
const CONCERN_SEVERITY_STYLES: Record<string, string> = {
	critical: "text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/30",
	moderate:
		"text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/30",
	minor: "text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/30",
};

/** Shape of findings returned by sub-review subtasks */
interface SubReviewConcern {
	severity: string;
	description: string;
	file?: string;
	line?: number;
	scope?: string;
}

interface SubReviewFindings {
	summary?: string;
	concerns?: SubReviewConcern[];
	positiveObservations?: string[];
}

/** Runtime type guard for SubReviewFindings shape */
function isSubReviewFindings(value: unknown): value is SubReviewFindings {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return false;
	}
	const obj = value as Record<string, unknown>;
	if (obj.summary !== undefined && typeof obj.summary !== "string") {
		return false;
	}
	if (obj.concerns !== undefined && !Array.isArray(obj.concerns)) {
		return false;
	}
	if (
		obj.positiveObservations !== undefined &&
		!Array.isArray(obj.positiveObservations)
	) {
		return false;
	}
	return true;
}

/**
 * Status badge for subtask items
 */
function SubtaskStatusBadge({ status }: { status: Subtask["status"] }) {
	switch (status) {
		case "pending":
			return (
				<span className="flex items-center gap-1 text-gray-500">
					<Circle className="h-4 w-4" />
					<span className="text-xs">Pending</span>
				</span>
			);
		case "running":
			return (
				<span className="flex items-center gap-1 text-blue-500">
					<Loader2 className="h-4 w-4 animate-spin" />
					<span className="text-xs">Running</span>
				</span>
			);
		case "completed":
			return (
				<span className="flex items-center gap-1 text-green-500">
					<CheckCircle className="h-4 w-4" />
					<span className="text-xs">Completed</span>
				</span>
			);
		case "failed":
			return (
				<span className="flex items-center gap-1 text-red-500">
					<XCircle className="h-4 w-4" />
					<span className="text-xs">Failed</span>
				</span>
			);
	}
}

/**
 * Structured display for sub-review findings
 */
function SubtaskFindings({ findings }: { findings: SubReviewFindings }) {
	const hasConcerns = findings.concerns && findings.concerns.length > 0;
	const hasObservations =
		findings.positiveObservations && findings.positiveObservations.length > 0;
	const hasOnlySummary = !hasConcerns && !hasObservations;

	return (
		<div className="space-y-3">
			{/* Summary */}
			{findings.summary && (
				<p className="text-sm text-muted-foreground">{findings.summary}</p>
			)}

			{/* Empty state */}
			{hasOnlySummary && (
				<p className="text-sm text-muted-foreground italic">No issues found.</p>
			)}

			{/* Concerns list */}
			{hasConcerns && (
				<div className="space-y-2">
					{findings.concerns?.map((concern, index) => {
						const severity = concern.severity || "minor";
						const severityStyle =
							CONCERN_SEVERITY_STYLES[severity] ??
							CONCERN_SEVERITY_STYLES.minor;
						const locationInfo = concern.file
							? concern.line
								? `${concern.file}:${concern.line}`
								: concern.file
							: null;

						return (
							<div
								key={`concern-${concern.file ?? ""}-${concern.line ?? ""}-${concern.severity ?? ""}-${index}`}
								className="border rounded-lg p-3 bg-background"
							>
								<div className="flex items-center gap-2 mb-1">
									<Badge
										variant="outline"
										className={cn("text-xs", severityStyle)}
									>
										{severity}
									</Badge>
									{locationInfo && (
										<code className="text-xs font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded">
											{locationInfo}
										</code>
									)}
								</div>
								<p className="text-sm text-muted-foreground">
									{concern.description}
								</p>
							</div>
						);
					})}
				</div>
			)}

			{/* Positive observations */}
			{hasObservations && (
				<div className="border border-green-500/30 bg-green-500/5 rounded-lg p-3">
					<div className="flex items-center gap-1.5 mb-2">
						<CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
						<span className="text-sm font-medium text-green-600 dark:text-green-400">
							Positive Observations
						</span>
					</div>
					<ul className="space-y-1">
						{findings.positiveObservations?.map((observation, index) => (
							<li
								key={`observation-${observation.slice(0, 32)}-${index}`}
								className="text-sm text-muted-foreground"
							>
								{observation}
							</li>
						))}
					</ul>
				</div>
			)}
		</div>
	);
}

/**
 * Collapsible item for a single subtask
 */
function SubtaskCollapsibleItem({ subtask }: { subtask: Subtask }) {
	// Auto-expand running subtasks, collapse completed by default
	const [isOpen, setIsOpen] = useState(subtask.status === "running");

	// Update open state when status changes
	useEffect(() => {
		setIsOpen(subtask.status === "running");
	}, [subtask.status]);

	const containerStyle = SUBTASK_CONTAINER_STYLES[subtask.status];

	return (
		<Collapsible open={isOpen} onOpenChange={setIsOpen}>
			<CollapsibleTrigger asChild>
				<button
					type="button"
					className={`flex w-full items-center justify-between rounded-lg border p-3 text-left hover:bg-accent/30 transition-colors ${containerStyle} transition-colors duration-200 motion-reduce:transition-none`}
				>
					<div className="flex items-center gap-3">
						{isOpen ? (
							<ChevronDown className="h-4 w-4 text-muted-foreground" />
						) : (
							<ChevronRight className="h-4 w-4 text-muted-foreground" />
						)}
						<span className="font-medium text-sm">{subtask.label}</span>
					</div>
					<SubtaskStatusBadge status={subtask.status} />
				</button>
			</CollapsibleTrigger>
			<CollapsibleContent>
				<div className="mt-2 space-y-2 pl-6">
					{/* Structured findings for completed subtasks */}
					{subtask.status === "completed" &&
						subtask.findings != null &&
						(isSubReviewFindings(subtask.findings) ? (
							<SubtaskFindings findings={subtask.findings} />
						) : (
							<div className="text-sm text-muted-foreground">
								<span style={{ whiteSpace: "pre-wrap" }}>
									{typeof subtask.findings === "string"
										? subtask.findings
										: JSON.stringify(subtask.findings, null, 2)}
								</span>
							</div>
						))}

					{/* Error display for failed subtasks */}
					{subtask.status === "failed" && (
						<div className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
							<AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
							<span>
								{subtask.findings != null &&
								typeof subtask.findings === "object" &&
								!Array.isArray(subtask.findings) &&
								"error" in subtask.findings &&
								typeof (subtask.findings as Record<string, unknown>).error ===
									"string"
									? String((subtask.findings as Record<string, unknown>).error)
									: typeof subtask.findings === "string"
										? subtask.findings
										: "This subtask failed to complete."}
							</span>
						</div>
					)}

					{/* Running placeholder */}
					{subtask.status === "running" && (
						<p className="text-sm text-muted-foreground italic">Reviewing...</p>
					)}
				</div>
			</CollapsibleContent>
		</Collapsible>
	);
}

/**
 * Subtask status section showing review subtask progress
 */
function SubtaskStatusSection({ subtasks }: { subtasks: Subtask[] }) {
	const completedCount = subtasks.filter(
		(s) => s.status === "completed",
	).length;
	const totalCount = subtasks.length;

	return (
		<div className="mx-4 mb-2">
			<Collapsible defaultOpen>
				<CollapsibleTrigger asChild>
					<button
						type="button"
						className="flex w-full items-center justify-between rounded-lg border p-3 text-left hover:bg-accent/30 transition-colors border-border bg-background"
					>
						<span className="font-medium text-base">Review Subtasks</span>
						<span className="text-sm text-muted-foreground">
							{completedCount}/{totalCount} completed
						</span>
					</button>
				</CollapsibleTrigger>
				<CollapsibleContent>
					<div className="mt-2 space-y-2 pl-2">
						{subtasks.map((subtask) => (
							<SubtaskCollapsibleItem key={subtask.id} subtask={subtask} />
						))}
					</div>
				</CollapsibleContent>
			</Collapsible>
		</div>
	);
}

interface ReviewStageViewProps extends StageViewProps {
	/** Review card artifacts for this workflow */
	reviewCards: ReviewCard[];
	/** Plans for previous stage context */
	plans: Plan[];
}

export function ReviewStageView({
	workflow,
	messages,
	streamingMessage,
	reviewCards,
	plans,
	onApproveWithMerge,
	onRequestChanges,
	onRequestFixes,
	onRewind,
}: ReviewStageViewProps) {
	const subtasks = useSubtasks(workflow.id);
	const messagesEndRef = useRef<HTMLDivElement>(null);

	// Filter messages for this stage
	const stageMessages = useMemo(
		() => messages.filter((msg) => msg.agentRole === "review"),
		[messages],
	);

	// Build artifactsByTurn map grouping review card artifacts by their turnId
	const artifactsByTurn = useMemo(() => {
		const map = new Map<string, ReviewCard>();

		for (const reviewCard of reviewCards) {
			if (reviewCard.turnId) {
				map.set(reviewCard.turnId, reviewCard);
			}
		}

		return map;
	}, [reviewCards]);

	// Get approved plan for PreviousStageContext
	const approvedPlan = useMemo(() => {
		return plans.find((p) => p.status === "approved") ?? null;
	}, [plans]);

	// Auto-scroll to bottom when new content arrives
	// biome-ignore lint/correctness/useExhaustiveDependencies: Auto-scroll on content changes
	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [stageMessages, streamingMessage?.segments]);

	const renderReviewCard = (reviewCard: ReviewCard) => {
		return (
			<ReviewCardApproval
				key={reviewCard.id}
				reviewCard={reviewCard}
				onApprove={
					reviewCard.status === "pending" ? onApproveWithMerge : undefined
				}
				onDeny={reviewCard.status === "pending" ? onRequestChanges : undefined}
				onRewind={
					reviewCard.status !== "pending" && onRewind
						? () => onRewind("review")
						: undefined
				}
				onRequestFixes={
					reviewCard.status === "pending" ? onRequestFixes : undefined
				}
			/>
		);
	};

	return (
		<>
			{/* PreviousStageContext: Show approved plan if exists */}
			{approvedPlan && (
				<div className="mx-4 mb-2">
					<PlanCardApproval
						key={`prev-${approvedPlan.id}`}
						plan={approvedPlan}
					/>
				</div>
			)}

			{/* Subtask status section: show between PreviousStageContext and messages */}
			{subtasks.length > 0 && <SubtaskStatusSection subtasks={subtasks} />}

			{/* Messages with interleaved artifacts */}
			{stageMessages.map((message) => {
				const reviewCard = artifactsByTurn.get(message.turnId);
				return (
					<div key={message.id}>
						<ChannelMessageBubble message={message} />
						{reviewCard && renderReviewCard(reviewCard)}
					</div>
				);
			})}

			{/* Streaming message (only if it belongs to this stage) */}
			{streamingMessage && streamingMessage.agentRole === "review" && (
				<StreamingMessageBubble message={streamingMessage} />
			)}

			{/* Auto-scroll anchor */}
			<div ref={messagesEndRef} />
		</>
	);
}
