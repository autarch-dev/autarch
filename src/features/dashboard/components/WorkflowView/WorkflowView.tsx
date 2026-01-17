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

/** Timeline item types for rendering */
type TimelineItem =
	| { type: "message"; data: ChannelMessage; timestamp: number }
	| { type: "scope_card"; data: ScopeCard; timestamp: number }
	| { type: "research_card"; data: ResearchCard; timestamp: number }
	| { type: "plan"; data: Plan; timestamp: number }
	| { type: "review_card"; data: ReviewCard; timestamp: number };

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

	// Build a unified timeline sorted by timestamp
	const timeline = useMemo((): TimelineItem[] => {
		const items: TimelineItem[] = [];

		// Add messages
		for (const message of messages) {
			items.push({
				type: "message",
				data: message,
				timestamp: message.timestamp,
			});
		}

		// Add scope cards
		for (const scopeCard of scopeCards) {
			items.push({
				type: "scope_card",
				data: scopeCard,
				timestamp: scopeCard.createdAt,
			});
		}

		// Add research cards
		for (const researchCard of researchCards) {
			items.push({
				type: "research_card",
				data: researchCard,
				timestamp: researchCard.createdAt,
			});
		}

		// Add plans
		for (const plan of plans) {
			items.push({ type: "plan", data: plan, timestamp: plan.createdAt });
		}

		// Add review cards
		for (const reviewCard of reviewCards) {
			items.push({
				type: "review_card",
				data: reviewCard,
				timestamp: reviewCard.createdAt,
			});
		}

		// Sort by timestamp (oldest first)
		return items.sort((a, b) => a.timestamp - b.timestamp);
	}, [messages, scopeCards, researchCards, plans, reviewCards]);

	// Auto-scroll to bottom when new content arrives
	// biome-ignore lint/correctness/useExhaustiveDependencies: Auto-scroll to bottom when new content arrives
	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [timeline, streamingMessage?.segments]);

	const hasAnyContent = timeline.length > 0 || streamingMessage;

	const renderTimelineItem = (item: TimelineItem) => {
		switch (item.type) {
			case "message":
				return <ChannelMessageBubble key={item.data.id} message={item.data} />;
			case "scope_card":
				return (
					<ScopeCardApproval
						key={item.data.id}
						scopeCard={item.data}
						onApprove={item.data.status === "pending" ? onApprove : undefined}
						onDeny={
							item.data.status === "pending" ? onRequestChanges : undefined
						}
					/>
				);
			case "research_card":
				return (
					<ResearchCardApproval
						key={item.data.id}
						researchCard={item.data}
						onApprove={item.data.status === "pending" ? onApprove : undefined}
						onDeny={
							item.data.status === "pending" ? onRequestChanges : undefined
						}
					/>
				);
			case "plan":
				return (
					<PlanCardApproval
						key={item.data.id}
						plan={item.data}
						onApprove={item.data.status === "pending" ? onApprove : undefined}
						onDeny={
							item.data.status === "pending" ? onRequestChanges : undefined
						}
						onRewind={item.data.status === "approved" ? onRewind : undefined}
					/>
				);
			case "review_card":
				return (
					<ReviewCardApproval
						key={item.data.id}
						reviewCard={item.data}
						onApprove={item.data.status === "pending" ? onApprove : undefined}
						onDeny={
							item.data.status === "pending" ? onRequestChanges : undefined
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
								{timeline.map(renderTimelineItem)}
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
