/**
 * ChannelViewContainer - Container component for ChannelView
 *
 * Owns data fetching and state management for a specific channel,
 * driven by URL parameter.
 */

import { useCallback, useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { useDiscussionsStore } from "../../store";
import { ChannelView } from "./ChannelView";

interface ChannelViewContainerProps {
	channelId: string;
}

export function ChannelViewContainer({ channelId }: ChannelViewContainerProps) {
	// Select only the data for this specific channel (shallow-compared)
	const { channel, channelsLoading, conversation } = useDiscussionsStore(
		useShallow((s) => ({
			channel: s.channels.find((c) => c.id === channelId),
			channelsLoading: s.channelsLoading,
			conversation: s.conversations.get(channelId),
		})),
	);

	// Actions are stable references — select individually without shallow comparison
	const selectChannel = useDiscussionsStore((s) => s.selectChannel);
	const fetchHistory = useDiscussionsStore((s) => s.fetchHistory);
	const sendMessage = useDiscussionsStore((s) => s.sendMessage);

	// Select channel and fetch history when channelId changes
	useEffect(() => {
		selectChannel(channelId);
		if (!conversation) {
			fetchHistory(channelId);
		}
	}, [channelId, conversation, selectChannel, fetchHistory]);

	const handleSendMessage = useCallback(
		async (content: string) => {
			await sendMessage(channelId, content);
		},
		[channelId, sendMessage],
	);

	// Channel not found - show not found state
	if (!channel) {
		return (
			<div className="flex items-center justify-center h-full">
				<p className="text-muted-foreground">Channel not found</p>
			</div>
		);
	}

	return (
		<ChannelView
			channel={channel}
			messages={conversation?.messages ?? []}
			streamingMessage={conversation?.streamingMessage}
			isLoading={conversation?.isLoading ?? channelsLoading}
			onSendMessage={handleSendMessage}
		/>
	);
}
