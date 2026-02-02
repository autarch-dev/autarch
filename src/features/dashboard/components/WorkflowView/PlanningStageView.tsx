/**
 * PlanningStageView - Renders the planning stage of a workflow
 *
 * Pure presentational component that displays messages with artifact interleaving
 * for the planning stage. Filters messages by stage and renders plan cards
 * after their associated turn. Shows approved research card as context.
 */

import { useEffect, useMemo, useRef } from "react";
import type { Plan, ResearchCard } from "@/shared/schemas/workflow";
import {
	ChannelMessageBubble,
	StreamingMessageBubble,
} from "../ChannelView/MessageBubble";
import { PlanCardApproval } from "./PlanCardApproval";
import { ResearchCardApproval } from "./ResearchCardApproval";
import type { StageViewProps } from "./types";

interface PlanningStageViewProps extends StageViewProps {
	/** Plan artifacts for this workflow */
	plans: Plan[];
	/** Research cards for previous stage context */
	researchCards: ResearchCard[];
}

export function PlanningStageView({
	messages,
	streamingMessage,
	plans,
	researchCards,
	onApprove,
	onRequestChanges,
	onRewind,
}: PlanningStageViewProps) {
	const messagesEndRef = useRef<HTMLDivElement>(null);

	// Filter messages for this stage
	const stageMessages = useMemo(
		() => messages.filter((msg) => msg.agentRole === "planning"),
		[messages],
	);

	// Build artifactsByTurn map grouping plan artifacts by their turnId
	const artifactsByTurn = useMemo(() => {
		const map = new Map<string, Plan>();

		for (const plan of plans) {
			if (plan.turnId) {
				map.set(plan.turnId, plan);
			}
		}

		return map;
	}, [plans]);

	// Get approved research card for PreviousStageContext
	const approvedResearchCard = useMemo(() => {
		return researchCards.find((r) => r.status === "approved") ?? null;
	}, [researchCards]);

	// Auto-scroll to bottom when new content arrives
	// biome-ignore lint/correctness/useExhaustiveDependencies: Auto-scroll on content changes
	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [stageMessages, streamingMessage?.segments]);

	const renderPlanCard = (plan: Plan) => {
		return (
			<PlanCardApproval
				key={plan.id}
				plan={plan}
				onApprove={plan.status === "pending" ? onApprove : undefined}
				onDeny={plan.status === "pending" ? onRequestChanges : undefined}
				onRewind={
					plan.status === "approved" && onRewind
						? () => onRewind("in_progress")
						: undefined
				}
			/>
		);
	};

	return (
		<>
			{/* PreviousStageContext: Show approved research card if exists */}
			{approvedResearchCard && (
				<div className="mx-4 mb-2">
					<ResearchCardApproval
						key={`prev-${approvedResearchCard.id}`}
						researchCard={approvedResearchCard}
					/>
				</div>
			)}

			{/* Messages with interleaved artifacts */}
			{stageMessages.map((message) => {
				const plan = artifactsByTurn.get(message.turnId);
				return (
					<div key={message.id}>
						<ChannelMessageBubble message={message} />
						{plan && renderPlanCard(plan)}
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
