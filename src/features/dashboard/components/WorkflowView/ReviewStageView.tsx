/**
 * ReviewStageView - Renders the review stage of a workflow
 *
 * Pure presentational component that displays messages with artifact interleaving
 * for the review stage. Filters messages by stage and renders review cards
 * after their associated turn. Shows approved plan as context.
 */

import { useEffect, useMemo, useRef } from "react";
import type { Plan, ReviewCard } from "@/shared/schemas/workflow";
import {
	ChannelMessageBubble,
	StreamingMessageBubble,
} from "../ChannelView/MessageBubble";
import { PlanCardApproval } from "./PlanCardApproval";
import ReviewCardApproval from "./ReviewCardApproval";
import type { StageViewProps } from "./types";

interface ReviewStageViewProps extends StageViewProps {
	/** Review card artifacts for this workflow */
	reviewCards: ReviewCard[];
	/** Plans for previous stage context */
	plans: Plan[];
}

export function ReviewStageView({
	messages,
	streamingMessage,
	reviewCards,
	plans,
	onApproveWithMerge,
	onRequestChanges,
	onRequestFixes,
	onRewind,
}: ReviewStageViewProps) {
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

			{/* Streaming message */}
			{streamingMessage && (
				<StreamingMessageBubble message={streamingMessage} />
			)}

			{/* Auto-scroll anchor */}
			<div ref={messagesEndRef} />
		</>
	);
}
