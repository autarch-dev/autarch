import { useEffect, useRef } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { Channel, ChannelMessage } from "@/shared/schemas/channel";
import type { StreamingMessage } from "../../store/discussionsStore";
import { MessageInput } from "../MessageInput";
import { ChannelHeader } from "./ChannelHeader";
import { ChannelMessageBubble, StreamingMessageBubble } from "./MessageBubble";

interface ChannelViewProps {
	channel: Channel;
	messages: ChannelMessage[];
	streamingMessage?: StreamingMessage;
	isLoading?: boolean;
	onSendMessage?: (content: string) => void;
}

export function ChannelView({
	channel,
	messages,
	streamingMessage,
	isLoading,
	onSendMessage,
}: ChannelViewProps) {
	const messagesEndRef = useRef<HTMLDivElement>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: Auto-scroll to bottom when new messages arrive
	useEffect(() => {
		const isStreaming = !!streamingMessage;
		messagesEndRef.current?.scrollIntoView({ 
			behavior: isStreaming ? "instant" : "smooth" 
		});
	}, [messages, streamingMessage?.segments]);

	return (
		<TooltipProvider>
			<div className="flex flex-col h-full">
				<ChannelHeader channel={channel} />

				<div className="flex-1 overflow-y-auto min-h-0">
					<div className="py-2">
						{isLoading && messages.length === 0 ? (
							<div className="flex items-center justify-center py-8">
								<span className="text-muted-foreground text-sm">
									Loading conversation...
								</span>
							</div>
						) : messages.length === 0 && !streamingMessage ? (
							<div className="flex flex-col items-center justify-center py-12 text-center px-4">
								<p className="text-muted-foreground text-sm mb-2">
									No messages yet in #{channel.name}
								</p>
								<p className="text-muted-foreground text-xs">
									Start a conversation with Autarch about your codebase
								</p>
							</div>
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
						<div ref={messagesEndRef} />
					</div>
				</div>

				<div className="shrink-0 p-4 border-t bg-background">
					<MessageInput
						placeholder={`Message #${channel.name}...`}
						onSend={onSendMessage}
						disabled={!!streamingMessage}
					/>
				</div>
			</div>
		</TooltipProvider>
	);
}
