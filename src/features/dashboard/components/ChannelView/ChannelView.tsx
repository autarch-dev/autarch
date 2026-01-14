import { TooltipProvider } from "@/components/ui/tooltip";
import type { Channel, Message } from "../../types";
import { MessageInput } from "../MessageInput";
import { ChannelHeader } from "./ChannelHeader";
import { ChannelMessageBubble } from "./ChannelMessageBubble";

interface ChannelViewProps {
	channel: Channel;
	messages: Message[];
	onSendMessage?: (content: string) => void;
}

export function ChannelView({
	channel,
	messages,
	onSendMessage,
}: ChannelViewProps) {
	return (
		<TooltipProvider>
			<div className="flex flex-col h-full">
				<ChannelHeader channel={channel} />

				<div className="flex-1 overflow-y-auto min-h-0">
					<div className="py-2">
						{messages.map((message) => (
							<ChannelMessageBubble key={message.id} message={message} />
						))}
					</div>
				</div>

				<div className="shrink-0 p-4 border-t bg-background">
					<MessageInput
						placeholder={`Message #${channel.name}...`}
						onSend={onSendMessage}
					/>
				</div>
			</div>
		</TooltipProvider>
	);
}
