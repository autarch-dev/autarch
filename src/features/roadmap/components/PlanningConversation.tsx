/**
 * PlanningConversation - AI planning conversation UI for roadmap creation
 *
 * Displays the conversational AI planning interface when a roadmap is in draft
 * status with an active session. Shows message history with streaming support,
 * tool call indicators, question prompts, and a message input.
 *
 * When the session completes (submit_roadmap tool finishes), shows a success
 * message indicating the roadmap has been generated.
 */

import { CheckCircle, Loader2, MapPin, Send, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
	ChannelMessageBubble,
	StreamingMessageBubble,
} from "@/features/dashboard/components/ChannelView/MessageBubble";
import type { RoadmapConversationState } from "../store/roadmapStore";

// =============================================================================
// Tool Label Mapping
// =============================================================================

/** Friendly labels for tool calls during roadmap planning */
const TOOL_LABELS: Record<string, string> = {
	submit_roadmap: "Generating roadmap...",
	submit_persona_roadmap: "Submitting persona roadmap...",
	ask_questions: "Preparing questions...",
	request_extension: "Thinking...",
};

function getToolLabel(toolName: string): string {
	return TOOL_LABELS[toolName] ?? toolName;
}

// =============================================================================
// Props
// =============================================================================

interface PlanningConversationProps {
	roadmapId: string;
	conversation: RoadmapConversationState;
	onSendMessage: (content: string) => void;
	/** Controls which input elements are visible.
	 * - 'full': default — free-text input shown (current behavior).
	 * - 'questions-only': free-text input hidden; inline question UI remains interactive.
	 * - 'disabled': all input hidden (same as session completed).
	 */
	inputMode?: "full" | "questions-only" | "disabled";
}

// =============================================================================
// Sub-components
// =============================================================================

function EmptyState() {
	return (
		<div className="flex flex-col items-center justify-center py-16 text-center px-4">
			<div className="rounded-full bg-primary/10 p-4 mb-4">
				<Sparkles className="size-8 text-primary" />
			</div>
			<h3 className="font-semibold text-lg mb-2">AI Roadmap Planning</h3>
			<p className="text-muted-foreground text-sm max-w-md">
				Describe your product or project goals and Autarch will help you create
				a comprehensive roadmap with milestones and initiatives.
			</p>
		</div>
	);
}

function SessionCompletedBanner() {
	return (
		<div className="mx-4 my-3 rounded-lg border border-green-500/30 bg-green-500/5 p-4">
			<div className="flex items-start gap-3">
				<CheckCircle className="size-5 text-green-600 mt-0.5 shrink-0" />
				<div>
					<p className="font-medium text-green-700 dark:text-green-400">
						Roadmap generated successfully!
					</p>
					<p className="text-sm text-muted-foreground mt-1">
						Your roadmap has been created with milestones and initiatives.
						Switch to the Timeline or Table view to review and edit.
					</p>
				</div>
			</div>
		</div>
	);
}

function ActiveToolIndicator({ toolName }: { toolName: string }) {
	return (
		<div className="mx-4 my-2 flex items-center gap-2 text-sm text-muted-foreground">
			<Loader2 className="size-4 animate-spin" />
			<span>{getToolLabel(toolName)}</span>
		</div>
	);
}

function PlanningMessageInput({
	onSend,
	disabled,
}: {
	onSend: (content: string) => void;
	disabled: boolean;
}) {
	const [message, setMessage] = useState("");

	const handleSend = () => {
		if (message.trim()) {
			onSend(message);
			setMessage("");
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	};

	return (
		<div className="border rounded-lg bg-background">
			<Textarea
				value={message}
				onChange={(e) => setMessage(e.target.value)}
				onKeyDown={handleKeyDown}
				placeholder="Describe your product goals or answer the questions above..."
				disabled={disabled}
				className="min-h-[60px] max-h-[200px] resize-none border-0 px-3 py-3 focus-visible:ring-0 focus-visible:ring-offset-0"
			/>
			<div className="flex items-center justify-between px-3 py-2 border-t bg-muted/30">
				<div className="flex items-center gap-2 text-xs text-muted-foreground">
					<MapPin className="size-3.5" />
					<span>AI Roadmap Planning</span>
				</div>
				<Button
					size="sm"
					onClick={handleSend}
					disabled={disabled || !message.trim()}
					className="h-7 gap-1.5"
				>
					<Send className="size-3.5" />
					<span className="text-xs">Send</span>
				</Button>
			</div>
		</div>
	);
}

// =============================================================================
// Main Component
// =============================================================================

export function PlanningConversation({
	roadmapId: _roadmapId,
	conversation,
	onSendMessage,
	inputMode = "full",
}: PlanningConversationProps) {
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const { messages, streamingMessage, isLoading, sessionStatus } = conversation;

	const isSessionCompleted = sessionStatus === "completed";
	const isStreaming = !!streamingMessage;

	// Find any currently running tool in the streaming message
	const activeToolName = streamingMessage?.tools.find(
		(t) => t.status === "running",
	)?.name;

	// Auto-scroll to bottom when new content arrives
	// biome-ignore lint/correctness/useExhaustiveDependencies: Auto-scroll on content changes
	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({
			behavior: isStreaming ? "instant" : "smooth",
		});
	}, [messages, streamingMessage?.segments]);

	return (
		<div className="flex flex-col h-full">
			<div className="py-2">
				{isLoading && messages.length === 0 ? (
					<div className="flex items-center justify-center py-8">
						<span className="text-muted-foreground text-sm">
							Loading conversation...
						</span>
					</div>
				) : messages.length === 0 && !streamingMessage ? (
					<EmptyState />
				) : (
					<>
						{messages.map((message) => (
							<ChannelMessageBubble key={message.id} message={message} />
						))}
						{streamingMessage && (
							<StreamingMessageBubble message={streamingMessage} />
						)}
						{/* Show prominent tool indicator for roadmap submission tools */}
						{(activeToolName === "submit_roadmap" ||
							activeToolName === "submit_persona_roadmap") && (
							<ActiveToolIndicator toolName={activeToolName} />
						)}
					</>
				)}

				{/* Session completed banner */}
				{isSessionCompleted && messages.length > 0 && (
					<SessionCompletedBanner />
				)}

				<div ref={messagesEndRef} />
			</div>
		</div>
	);
}
