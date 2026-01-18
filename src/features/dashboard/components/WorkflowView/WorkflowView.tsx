/**
 * WorkflowView - Main view for a workflow conversation
 *
 * Displays the workflow header, messages (with streaming support),
 * and artifact cards (scope, research, plan) interleaved by timestamp.
 */

import { useEffect, useMemo, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { ChannelMessage } from "@/shared/schemas/channel";
import type {
	Plan,
	ResearchCard,
	ReviewCard,
	ScopeCard,
	Workflow,
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
	onApprove?: () => Promise<void>;
	onRequestChanges?: (feedback: string) => Promise<void>;
	onRewind?: () => Promise<void>;
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
	onApprove,
	onRequestChanges,
	onRewind,
}: WorkflowViewProps) {
	const messagesEndRef = useRef<HTMLDivElement>(null);

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

	// Auto-scroll to bottom when new content arrives
	// biome-ignore lint/correctness/useExhaustiveDependencies: Auto-scroll to bottom when new content arrives
	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages, streamingMessage?.segments]);

	const hasAnyContent = messages.length > 0 || streamingMessage;

	const renderArtifact = (artifact: TurnArtifact) => {
		switch (artifact.type) {
			case "scope_card":
				return (
					<ScopeCardApproval
						key={artifact.data.id}
						scopeCard={artifact.data}
						onApprove={
							artifact.data.status === "pending" ? onApprove : undefined
						}
						onDeny={
							artifact.data.status === "pending" ? onRequestChanges : undefined
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
							artifact.data.status === "approved" ? onRewind : undefined
						}
					/>
				);
			case "review_card":
				return (
					<ReviewCardApproval
						key={artifact.data.id}
						reviewCard={artifact.data}
						onApprove={
							artifact.data.status === "pending" ? onApprove : undefined
						}
						onDeny={
							artifact.data.status === "pending" ? onRequestChanges : undefined
						}
					/>
				);
		}
	};

	return (
		<TooltipProvider>
			<div className="flex flex-col h-full">
				<WorkflowHeader workflow={workflow} />

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
								{messages.map((message) => {
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
