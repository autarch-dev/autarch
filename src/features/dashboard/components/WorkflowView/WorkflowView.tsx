/**
 * WorkflowView - Main view for a workflow conversation
 *
 * Displays the workflow header, messages (with streaming support),
 * scope card approval UI when applicable, and message input.
 */

import { useEffect, useRef } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { ChannelMessage } from "@/shared/schemas/channel";
import type {
	ResearchCard,
	ScopeCard,
	Workflow,
} from "@/shared/schemas/workflow";
import type { StreamingMessage } from "../../store/workflowsStore";
import {
	ChannelMessageBubble,
	StreamingMessageBubble,
} from "../ChannelView/MessageBubble";
import { ResearchCardApproval } from "./ResearchCardApproval";
import { ScopeCardApproval } from "./ScopeCardApproval";
import { WorkflowEmptyState } from "./WorkflowEmptyState";
import { WorkflowHeader } from "./WorkflowHeader";

interface WorkflowViewProps {
	workflow: Workflow;
	messages: ChannelMessage[];
	streamingMessage?: StreamingMessage;
	isLoading?: boolean;
	pendingScopeCard?: ScopeCard;
	pendingResearchCard?: ResearchCard;
	onApprove?: () => Promise<void>;
	onRequestChanges?: (feedback: string) => Promise<void>;
}

export function WorkflowView({
	workflow,
	messages,
	streamingMessage,
	isLoading,
	pendingScopeCard,
	pendingResearchCard,
	onApprove,
	onRequestChanges,
}: WorkflowViewProps) {
	const messagesEndRef = useRef<HTMLDivElement>(null);

	// Auto-scroll to bottom when new messages arrive
	// biome-ignore lint/correctness/useExhaustiveDependencies: Auto-scroll to bottom when new messages arrive
	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages, streamingMessage?.segments]);

	const showScopeApproval =
		workflow.awaitingApproval &&
		workflow.pendingArtifactType === "scope_card" &&
		pendingScopeCard &&
		onApprove &&
		onRequestChanges;

	const showResearchApproval =
		workflow.awaitingApproval &&
		workflow.pendingArtifactType === "research" &&
		pendingResearchCard &&
		onApprove &&
		onRequestChanges;

	return (
		<TooltipProvider>
			<div className="flex flex-col h-full">
				<WorkflowHeader workflow={workflow} />

				<div className="flex-1 overflow-y-auto min-h-0">
					<div className="py-2">
						{isLoading && messages.length === 0 ? (
							<div className="flex items-center justify-center py-8">
								<span className="text-muted-foreground text-sm">
									Loading conversation...
								</span>
							</div>
						) : messages.length === 0 &&
							!streamingMessage &&
							!showScopeApproval &&
							!showResearchApproval ? (
							<WorkflowEmptyState />
						) : (
							<>
								{messages.map((message) => (
									<ChannelMessageBubble key={message.id} message={message} />
								))}
								{streamingMessage && (
									<StreamingMessageBubble message={streamingMessage} />
								)}
							</>
						)}

						{/* Scope Card Approval UI */}
						{showScopeApproval && (
							<ScopeCardApproval
								scopeCard={pendingScopeCard}
								onApprove={onApprove}
								onDeny={onRequestChanges}
							/>
						)}

						{/* Research Card Approval UI */}
						{showResearchApproval && (
							<ResearchCardApproval
								researchCard={pendingResearchCard}
								onApprove={onApprove}
								onDeny={onRequestChanges}
							/>
						)}

						<div ref={messagesEndRef} />
					</div>
				</div>
			</div>
		</TooltipProvider>
	);
}
