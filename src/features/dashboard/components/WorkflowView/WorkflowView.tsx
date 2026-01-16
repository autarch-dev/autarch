/**
 * WorkflowView - Main view for a workflow conversation
 *
 * Displays the workflow header, messages (with streaming support),
 * scope card approval UI when applicable, and message input.
 */

import { useEffect, useRef } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { ChannelMessage } from "@/shared/schemas/channel";
import type { ScopeCard, Workflow } from "@/shared/schemas/workflow";
import type { StreamingMessage } from "../../store/workflowsStore";
import {
	ChannelMessageBubble,
	StreamingMessageBubble,
} from "../ChannelView/MessageBubble";
import { MessageInput } from "../MessageInput";
import { ScopeCardApproval } from "./ScopeCardApproval";
import { WorkflowEmptyState } from "./WorkflowEmptyState";
import { WorkflowHeader } from "./WorkflowHeader";

interface WorkflowViewProps {
	workflow: Workflow;
	messages: ChannelMessage[];
	streamingMessage?: StreamingMessage;
	isLoading?: boolean;
	pendingScopeCard?: ScopeCard;
	onSendMessage?: (content: string) => void;
	onApproveScope?: () => Promise<void>;
	onRequestChanges?: (feedback: string) => Promise<void>;
}

export function WorkflowView({
	workflow,
	messages,
	streamingMessage,
	isLoading,
	pendingScopeCard,
	onSendMessage,
	onApproveScope,
	onRequestChanges,
}: WorkflowViewProps) {
	const messagesEndRef = useRef<HTMLDivElement>(null);

	// Auto-scroll to bottom when new messages arrive
	// biome-ignore lint/correctness/useExhaustiveDependencies: Auto-scroll to bottom when new messages arrive
	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages, streamingMessage?.segments]);

	const showApproval =
		workflow.awaitingApproval &&
		workflow.pendingArtifactType === "scope_card" &&
		pendingScopeCard &&
		onApproveScope &&
		onRequestChanges;

	// Determine if input should be disabled
	const inputDisabled =
		!!streamingMessage || workflow.awaitingApproval || !workflow.currentSessionId;

	// Determine placeholder text
	let placeholder = "Describe your task or ask a question...";
	if (workflow.awaitingApproval) {
		placeholder = "Review the scope card above and approve or request changes...";
	} else if (!workflow.currentSessionId) {
		placeholder = "Waiting for agent session to start...";
	}

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
						) : messages.length === 0 && !streamingMessage && !showApproval ? (
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
						{showApproval && (
							<ScopeCardApproval
								scopeCard={pendingScopeCard}
								onApprove={onApproveScope}
								onDeny={onRequestChanges}
							/>
						)}

						<div ref={messagesEndRef} />
					</div>
				</div>

				<div className="shrink-0 p-4 border-t bg-background">
					<MessageInput
						placeholder={placeholder}
						onSend={onSendMessage}
						disabled={inputDisabled}
					/>
				</div>
			</div>
		</TooltipProvider>
	);
}
