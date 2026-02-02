/**
 * ScopingStageView - Renders the scoping stage of a workflow
 *
 * Pure presentational component that displays messages with artifact interleaving
 * for the scoping stage. Filters messages by stage and renders scope cards
 * after their associated turn.
 */

import { useEffect, useMemo, useRef } from "react";
import {
	Card,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import type { ScopeCard } from "@/shared/schemas/workflow";
import {
	ChannelMessageBubble,
	StreamingMessageBubble,
} from "../ChannelView/MessageBubble";
import { ScopeCardApproval } from "./ScopeCardApproval";
import type { StageViewProps } from "./types";

interface ScopingStageViewProps extends StageViewProps {
	/** Scope cards for this workflow */
	scopeCards: ScopeCard[];
}

export function ScopingStageView({
	workflow,
	messages,
	streamingMessage,
	scopeCards,
	onApproveScope,
	onRequestChanges,
	onRewind,
}: ScopingStageViewProps) {
	const messagesEndRef = useRef<HTMLDivElement>(null);

	// Filter messages for this stage
	const stageMessages = useMemo(
		() => messages.filter((msg) => msg.agentRole === "scoping"),
		[messages],
	);

	// Build artifactsByTurn map grouping scope cards by their turnId
	const artifactsByTurn = useMemo(() => {
		const map = new Map<string, ScopeCard>();

		for (const scopeCard of scopeCards) {
			if (scopeCard.turnId) {
				map.set(scopeCard.turnId, scopeCard);
			}
		}

		return map;
	}, [scopeCards]);

	// Auto-scroll to bottom when new content arrives
	// biome-ignore lint/correctness/useExhaustiveDependencies: Auto-scroll on content changes
	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [stageMessages, streamingMessage?.segments]);

	const renderScopeCard = (scopeCard: ScopeCard) => {
		return (
			<ScopeCardApproval
				key={scopeCard.id}
				scopeCard={scopeCard}
				onApprove={scopeCard.status === "pending" ? onApproveScope : undefined}
				onDeny={scopeCard.status === "pending" ? onRequestChanges : undefined}
				onRewind={
					scopeCard.status === "approved" && onRewind
						? () => onRewind("researching")
						: undefined
				}
			/>
		);
	};

	return (
		<>
			{/* PreviousStageContext: For scoping stage, show workflow context card */}
			<Card className="mx-4 mb-2">
				<CardHeader>
					<CardTitle>{workflow.title}</CardTitle>
					{workflow.description && (
						<CardDescription>{workflow.description}</CardDescription>
					)}
				</CardHeader>
			</Card>

			{/* Messages with interleaved artifacts */}
			{stageMessages.map((message) => {
				const scopeCard = artifactsByTurn.get(message.turnId);
				return (
					<div key={message.id}>
						<ChannelMessageBubble message={message} />
						{scopeCard && renderScopeCard(scopeCard)}
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
