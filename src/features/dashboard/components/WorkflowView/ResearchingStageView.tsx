/**
 * ResearchingStageView - Renders the researching stage of a workflow
 *
 * Pure presentational component that displays messages with artifact interleaving
 * for the researching stage. Filters messages by stage and renders research cards
 * after their associated turn. Shows approved scope card as context.
 */

import { useEffect, useMemo, useRef } from "react";
import type { ResearchCard, ScopeCard } from "@/shared/schemas/workflow";
import {
	WorkflowMessageBubble,
	WorkflowStreamingBubble,
} from "../ChannelView/MessageBubble";
import { ResearchCardApproval } from "./ResearchCardApproval";
import { ScopeCardApproval } from "./ScopeCardApproval";
import type { StageViewProps } from "./types";

interface ResearchingStageViewProps extends StageViewProps {
	/** Research cards for this workflow */
	researchCards: ResearchCard[];
	/** Scope cards for previous stage context */
	scopeCards: ScopeCard[];
}

export function ResearchingStageView({
	messages,
	streamingMessage,
	researchCards,
	scopeCards,
	onApprove,
	onRequestChanges,
	onRewind,
}: ResearchingStageViewProps) {
	const messagesEndRef = useRef<HTMLDivElement>(null);

	// Filter messages for this stage
	const stageMessages = useMemo(
		() => messages.filter((msg) => msg.agentRole === "research"),
		[messages],
	);

	// Build artifactsByTurn map grouping research cards by their turnId
	const artifactsByTurn = useMemo(() => {
		const map = new Map<string, ResearchCard>();

		for (const researchCard of researchCards) {
			if (researchCard.turnId) {
				map.set(researchCard.turnId, researchCard);
			}
		}

		return map;
	}, [researchCards]);

	// Get approved scope card for PreviousStageContext
	const approvedScopeCard = useMemo(() => {
		return scopeCards.find((s) => s.status === "approved") ?? null;
	}, [scopeCards]);

	// Auto-scroll to bottom when new content arrives
	// biome-ignore lint/correctness/useExhaustiveDependencies: Auto-scroll on content changes
	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [stageMessages, streamingMessage?.segments]);

	const renderResearchCard = (researchCard: ResearchCard) => {
		return (
			<ResearchCardApproval
				key={researchCard.id}
				researchCard={researchCard}
				onApprove={researchCard.status === "pending" ? onApprove : undefined}
				onDeny={
					researchCard.status === "pending" ? onRequestChanges : undefined
				}
				onRewind={
					researchCard.status === "approved" && onRewind
						? () => onRewind("planning")
						: undefined
				}
			/>
		);
	};

	return (
		<div className="space-y-3">
			{/* PreviousStageContext: Show approved scope card if exists */}
			{approvedScopeCard && (
				<div>
					<ScopeCardApproval
						key={`prev-${approvedScopeCard.id}`}
						scopeCard={approvedScopeCard}
					/>
				</div>
			)}

			{/* Messages with interleaved artifacts */}
			{stageMessages.map((message) => {
				const researchCard = artifactsByTurn.get(message.turnId);
				return (
					<div key={message.id}>
						<WorkflowMessageBubble message={message} />
						{researchCard && renderResearchCard(researchCard)}
					</div>
				);
			})}

			{/* Streaming message (only if it belongs to this stage) */}
			{streamingMessage && streamingMessage.agentRole === "research" && (
				<WorkflowStreamingBubble message={streamingMessage} />
			)}

			{/* Auto-scroll anchor */}
			<div ref={messagesEndRef} />
		</div>
	);
}
