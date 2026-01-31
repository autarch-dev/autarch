/**
 * WorkflowView - Main view for a workflow conversation
 *
 * Displays the workflow header, messages (with streaming support),
 * and artifact cards (scope, research, plan) interleaved by timestamp.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { ChannelMessage } from "@/shared/schemas/channel";
import type {
	MergeStrategy,
	Plan,
	ResearchCard,
	ReviewCard,
	RewindTarget,
	ScopeCard,
	Workflow,
	WorkflowStatus,
} from "@/shared/schemas/workflow";
import type { StreamingMessage } from "../../store/workflowsStore";
import {
	ChannelMessageBubble,
	StreamingMessageBubble,
} from "../ChannelView/MessageBubble";
import { PlanCardApproval } from "./PlanCardApproval";
import { ResearchCardApproval } from "./ResearchCardApproval";
import { ReviewCardApproval } from "./ReviewCardApproval";
import { ScopeCardApproval } from "./ScopeCardApproval";
import { WorkflowEmptyState } from "./WorkflowEmptyState";
import { WorkflowHeader } from "./WorkflowHeader";

interface WorkflowViewProps {
	workflow: Workflow;
	messages: ChannelMessage[];
	streamingMessage?: StreamingMessage;
	isLoading?: boolean;
	scopeCards: ScopeCard[];
	researchCards: ResearchCard[];
	plans: Plan[];
	reviewCards: ReviewCard[];
	onApproveScope?: (path: "quick" | "full") => Promise<void>;
	onApprove?: () => Promise<void>;
	onApproveWithMerge?: (mergeOptions: {
		mergeStrategy: MergeStrategy;
		commitMessage: string;
	}) => Promise<void>;
	onRequestChanges?: (feedback: string) => Promise<void>;
	onRequestFixes?: (commentIds: string[], summary?: string) => Promise<void>;
	onRewind?: (targetStage: RewindTarget) => Promise<void>;
	onArchived?: () => void;
}

/** Artifact for a turn (only one per turn) */
type TurnArtifact =
	| { type: "scope_card"; data: ScopeCard }
	| { type: "research_card"; data: ResearchCard }
	| { type: "plan"; data: Plan }
	| { type: "review_card"; data: ReviewCard };

export function WorkflowView({
	workflow,
	messages,
	streamingMessage,
	isLoading,
	scopeCards,
	researchCards,
	plans,
	reviewCards,
	onApproveScope,
	onApprove,
	onApproveWithMerge,
	onRequestChanges,
	onRequestFixes,
	onRewind,
	onArchived,
}: WorkflowViewProps) {
	const messagesEndRef = useRef<HTMLDivElement>(null);

	// Track which stage the user is currently viewing (may differ from workflow.status)
	const [viewedStage, setViewedStage] = useState<WorkflowStatus>(
		workflow.status,
	);

	// Reset viewedStage when workflow changes (both id and status trigger reset)
	// biome-ignore lint/correctness/useExhaustiveDependencies: Intentionally reset on workflow.id change even though status is the value
	useEffect(() => {
		setViewedStage(workflow.status);
	}, [workflow.id, workflow.status]);

	// Build a map of turnId -> artifact (one artifact per turn max)
	const artifactsByTurn = useMemo(() => {
		const map = new Map<string, TurnArtifact>();

		for (const scopeCard of scopeCards) {
			if (scopeCard.turnId) {
				map.set(scopeCard.turnId, { type: "scope_card", data: scopeCard });
			}
		}
		for (const researchCard of researchCards) {
			if (researchCard.turnId) {
				map.set(researchCard.turnId, {
					type: "research_card",
					data: researchCard,
				});
			}
		}
		for (const plan of plans) {
			if (plan.turnId) {
				map.set(plan.turnId, { type: "plan", data: plan });
			}
		}
		for (const reviewCard of reviewCards) {
			if (reviewCard.turnId) {
				map.set(reviewCard.turnId, { type: "review_card", data: reviewCard });
			}
		}

		return map;
	}, [scopeCards, researchCards, plans, reviewCards]);

	/**
	 * Build stage boundaries from approved artifacts.
	 * Each stage's boundary is defined by the turnId of its approved artifact.
	 * - scoping ends at ScopeCard turnId
	 * - researching ends at ResearchCard turnId
	 * - planning ends at Plan turnId
	 * - in_progress ends at ReviewCard turnId
	 *
	 * @returns Map<WorkflowStatus, {startTurnId: string | null, endTurnId: string | null}>
	 */
	const buildStageBoundaries = (): Map<
		WorkflowStatus,
		{ startTurnId: string | null; endTurnId: string | null }
	> => {
		const boundaries = new Map<
			WorkflowStatus,
			{ startTurnId: string | null; endTurnId: string | null }
		>();

		// Collect all approved artifacts with their turnIds and createdAt timestamps
		type ApprovedArtifact = {
			type: "scope_card" | "research_card" | "plan" | "review_card";
			turnId: string;
			createdAt: number;
		};

		const approvedArtifacts: ApprovedArtifact[] = [];

		for (const scopeCard of scopeCards) {
			if (scopeCard.status === "approved" && scopeCard.turnId) {
				approvedArtifacts.push({
					type: "scope_card",
					turnId: scopeCard.turnId,
					createdAt: scopeCard.createdAt,
				});
			}
		}

		for (const researchCard of researchCards) {
			if (researchCard.status === "approved" && researchCard.turnId) {
				approvedArtifacts.push({
					type: "research_card",
					turnId: researchCard.turnId,
					createdAt: researchCard.createdAt,
				});
			}
		}

		for (const plan of plans) {
			if (plan.status === "approved" && plan.turnId) {
				approvedArtifacts.push({
					type: "plan",
					turnId: plan.turnId,
					createdAt: plan.createdAt,
				});
			}
		}

		for (const reviewCard of reviewCards) {
			if (reviewCard.status === "approved" && reviewCard.turnId) {
				approvedArtifacts.push({
					type: "review_card",
					turnId: reviewCard.turnId,
					createdAt: reviewCard.createdAt,
				});
			}
		}

		// Sort by createdAt to establish order
		approvedArtifacts.sort((a, b) => a.createdAt - b.createdAt);

		// Map artifact types to their ending stages
		const artifactToStage: Record<ApprovedArtifact["type"], WorkflowStatus> = {
			scope_card: "scoping",
			research_card: "researching",
			plan: "planning",
			review_card: "in_progress",
		};

		// Build boundaries: each stage starts after the previous stage's artifact
		// and ends at its own artifact
		let previousEndTurnId: string | null = null;

		for (const artifact of approvedArtifacts) {
			const stage = artifactToStage[artifact.type];
			boundaries.set(stage, {
				startTurnId: previousEndTurnId,
				endTurnId: artifact.turnId,
			});
			previousEndTurnId = artifact.turnId;
		}

		// Handle stages without approved artifacts yet
		const allStages: WorkflowStatus[] = [
			"scoping",
			"researching",
			"planning",
			"in_progress",
			"review",
			"done",
		];
		for (const stage of allStages) {
			if (!boundaries.has(stage)) {
				// Stage hasn't completed - find the previous stage's end
				const stageIndex = allStages.indexOf(stage);
				let startTurnId: string | null = null;

				// Look backwards to find the most recent completed stage's endTurnId
				for (let i = stageIndex - 1; i >= 0; i--) {
					const prevStage = allStages[i];
					if (prevStage && boundaries.has(prevStage)) {
						startTurnId = boundaries.get(prevStage)?.endTurnId ?? null;
						break;
					}
				}

				boundaries.set(stage, {
					startTurnId,
					endTurnId: null, // Stage not complete yet
				});
			}
		}

		return boundaries;
	};

	/**
	 * Filter messages to show only those belonging to a specific stage.
	 * Uses stage boundaries based on approved artifact turnIds.
	 *
	 * Edge case: if no approved artifacts exist, return all messages for scoping stage.
	 *
	 * @param allMessages - All messages in the workflow
	 * @param stageBoundaries - Map of stage to turnId boundaries
	 * @param targetStage - The stage to filter messages for
	 * @returns Filtered messages belonging to the target stage
	 */
	const filterMessagesByStage = (
		allMessages: ChannelMessage[],
		stageBoundaries: Map<
			WorkflowStatus,
			{ startTurnId: string | null; endTurnId: string | null }
		>,
		targetStage: WorkflowStatus,
	): ChannelMessage[] => {
		const boundary = stageBoundaries.get(targetStage);

		// Edge case: if no approved artifacts exist, return all messages for scoping stage
		const hasAnyApprovedArtifacts = Array.from(stageBoundaries.values()).some(
			(b) => b.endTurnId !== null,
		);
		if (!hasAnyApprovedArtifacts && targetStage === "scoping") {
			return allMessages;
		}

		if (!boundary) {
			return [];
		}

		// Build a map of turnId -> message index for ordering
		const turnIdToIndex = new Map<string, number>();
		for (let i = 0; i < allMessages.length; i++) {
			const msg = allMessages[i];
			if (msg && !turnIdToIndex.has(msg.turnId)) {
				turnIdToIndex.set(msg.turnId, i);
			}
		}

		const { startTurnId, endTurnId } = boundary;

		// Determine start and end indices
		const startIndex =
			startTurnId !== null ? (turnIdToIndex.get(startTurnId) ?? -1) + 1 : 0;
		const endIndex =
			endTurnId !== null
				? (turnIdToIndex.get(endTurnId) ?? allMessages.length - 1)
				: allMessages.length - 1;

		// Filter messages within the boundary range
		return allMessages.filter((msg) => {
			const msgIndex = turnIdToIndex.get(msg.turnId);
			if (msgIndex === undefined) return false;

			// Include messages from startIndex (exclusive of previous boundary)
			// up to and including endIndex (inclusive of this stage's artifact)
			return msgIndex >= startIndex && msgIndex <= endIndex;
		});
	};

	// Build stage boundaries for filtering (memoized)
	// biome-ignore lint/correctness/useExhaustiveDependencies: buildStageBoundaries is stable and only uses artifacts arrays
	const stageBoundaries = useMemo(
		() => buildStageBoundaries(),
		[scopeCards, researchCards, plans, reviewCards],
	);

	// Filter messages for current viewed stage
	// biome-ignore lint/correctness/useExhaustiveDependencies: filterMessagesByStage is a pure function with explicit parameters
	const filteredMessages = useMemo(
		() => filterMessagesByStage(messages, stageBoundaries, viewedStage),
		[messages, stageBoundaries, viewedStage],
	);

	// Calculate total cost from all messages
	const totalCost = useMemo(() => {
		return messages.reduce((sum, m) => sum + (m.cost ?? 0), 0);
	}, [messages]);

	// Track previous viewedStage to detect stage navigation vs new content
	const prevViewedStageRef = useRef<WorkflowStatus>(viewedStage);

	// Auto-scroll to bottom when new content arrives, but not when navigating stages
	// biome-ignore lint/correctness/useExhaustiveDependencies: Smart auto-scroll based on stage navigation vs new content
	useEffect(() => {
		// If viewedStage changed, user navigated to a different stage - skip scroll
		if (prevViewedStageRef.current !== viewedStage) {
			prevViewedStageRef.current = viewedStage;
			return;
		}

		// viewedStage is the same, so messages or streamingMessage changed - scroll to bottom
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [viewedStage, filteredMessages, streamingMessage?.segments]);

	const hasAnyContent = messages.length > 0 || streamingMessage;

	const renderArtifact = (artifact: TurnArtifact) => {
		switch (artifact.type) {
			case "scope_card":
				return (
					<ScopeCardApproval
						key={artifact.data.id}
						scopeCard={artifact.data}
						onApprove={
							artifact.data.status === "pending" ? onApproveScope : undefined
						}
						onDeny={
							artifact.data.status === "pending" ? onRequestChanges : undefined
						}
						onRewind={
							artifact.data.status === "approved" && onRewind
								? () => onRewind("researching")
								: undefined
						}
					/>
				);
			case "research_card":
				return (
					<ResearchCardApproval
						key={artifact.data.id}
						researchCard={artifact.data}
						onApprove={
							artifact.data.status === "pending" ? onApprove : undefined
						}
						onDeny={
							artifact.data.status === "pending" ? onRequestChanges : undefined
						}
						onRewind={
							artifact.data.status === "approved" && onRewind
								? () => onRewind("planning")
								: undefined
						}
					/>
				);
			case "plan":
				return (
					<PlanCardApproval
						key={artifact.data.id}
						plan={artifact.data}
						onApprove={
							artifact.data.status === "pending" ? onApprove : undefined
						}
						onDeny={
							artifact.data.status === "pending" ? onRequestChanges : undefined
						}
						onRewind={
							artifact.data.status === "approved" && onRewind
								? () => onRewind("in_progress")
								: undefined
						}
					/>
				);
			case "review_card":
				return (
					<ReviewCardApproval
						key={artifact.data.id}
						reviewCard={artifact.data}
						onApprove={
							artifact.data.status === "pending"
								? onApproveWithMerge
								: undefined
						}
						onDeny={
							artifact.data.status === "pending" ? onRequestChanges : undefined
						}
						onRewind={
							artifact.data.status !== "pending" && onRewind
								? () => onRewind("review")
								: undefined
						}
						onRequestFixes={
							artifact.data.status === "pending" ? onRequestFixes : undefined
						}
					/>
				);
		}
	};

	return (
		<TooltipProvider>
			<div className="flex flex-col h-full">
				<WorkflowHeader
					workflow={workflow}
					totalCost={totalCost}
					onArchived={onArchived}
				/>

				<ScrollArea className="flex-1 min-h-0">
					<div className="py-2">
						{isLoading && !hasAnyContent ? (
							<div className="flex items-center justify-center py-8">
								<span className="text-muted-foreground text-sm">
									Loading conversation...
								</span>
							</div>
						) : !hasAnyContent ? (
							<WorkflowEmptyState />
						) : (
							<>
								{filteredMessages.map((message) => {
									const artifact = artifactsByTurn.get(message.turnId);
									return (
										<div key={message.id}>
											<ChannelMessageBubble message={message} />
											{artifact && renderArtifact(artifact)}
										</div>
									);
								})}
								{streamingMessage && (
									<StreamingMessageBubble message={streamingMessage} />
								)}
							</>
						)}

						<div ref={messagesEndRef} />
					</div>
				</ScrollArea>
			</div>
		</TooltipProvider>
	);
}
