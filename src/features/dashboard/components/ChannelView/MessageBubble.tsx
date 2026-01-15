/**
 * MessageBubble - Unified component for both streaming and completed messages
 *
 * Renders interleaved text segments and tool calls with proper styling
 * for both in-progress streaming and completed message states.
 */

import { CheckCircle2, Loader2, Wrench, XCircle } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ChannelMessage, MessageSegment } from "@/shared/schemas/channel";
import type { StreamingMessage } from "../../store/discussionsStore";
import { formatTime } from "../../utils";
import { Markdown } from "../Markdown";

// =============================================================================
// Types
// =============================================================================

/** Common tool call structure used by both message types */
export interface ToolCallInfo {
	id: string;
	name: string;
	input: unknown;
	output?: unknown;
	status: "running" | "completed" | "error";
}

/** Segment with optional streaming state */
interface SegmentInfo {
	index: number;
	content: string;
	/** Only present for streaming messages */
	isComplete?: boolean;
}

type InterleavedItem =
	| { type: "segment"; segment: SegmentInfo }
	| { type: "tool"; tool: ToolCallInfo };

// =============================================================================
// Props
// =============================================================================

interface StreamingMessageBubbleProps {
	variant: "streaming";
	message: StreamingMessage;
}

interface CompletedMessageBubbleProps {
	variant: "completed";
	message: ChannelMessage;
}

export type MessageBubbleProps =
	| StreamingMessageBubbleProps
	| CompletedMessageBubbleProps;

// =============================================================================
// Utilities
// =============================================================================

/**
 * Build interleaved content items from segments and tools.
 * Pattern: segment[0] -> tool[0] -> segment[1] -> tool[1] -> ...
 */
function buildInterleavedContent(
	segments: SegmentInfo[],
	tools: ToolCallInfo[],
): InterleavedItem[] {
	const items: InterleavedItem[] = [];
	const maxIndex = Math.max(segments.length - 1, tools.length - 1);

	for (let i = 0; i <= maxIndex; i++) {
		// Add segment at this index if it exists
		const segment = segments.find((s) => s.index === i);
		if (segment) {
			items.push({ type: "segment", segment });
		}

		// Add tool at this index if it exists
		const tool = tools[i];
		if (tool) {
			items.push({ type: "tool", tool });
		}
	}

	return items;
}

/** Extract the reason field from tool input if present */
function getToolReason(input: unknown): string | undefined {
	if (
		typeof input === "object" &&
		input !== null &&
		"reason" in input &&
		typeof (input as Record<string, unknown>).reason === "string"
	) {
		return (input as Record<string, unknown>).reason as string;
	}
	return undefined;
}

// =============================================================================
// Sub-components
// =============================================================================

interface ToolCallDisplayProps {
	tool: ToolCallInfo;
	/** Whether to expand by default (for running tools) */
	defaultOpen?: boolean;
}

function ToolCallDisplay({ tool, defaultOpen }: ToolCallDisplayProps) {
	const reason = getToolReason(tool.input);
	const isRunning = tool.status === "running";

	return (
		<details className="group text-xs" open={defaultOpen ?? isRunning}>
			<summary className="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-muted/50 transition-colors list-none">
				<Wrench className="size-3 text-muted-foreground shrink-0" />
				<span className="font-mono text-muted-foreground">{tool.name}</span>
				{reason && (
					<span className="text-muted-foreground/60 truncate flex-1">
						— {reason}
					</span>
				)}
				{tool.status === "running" && (
					<Loader2 className="size-3 animate-spin text-muted-foreground shrink-0" />
				)}
				{tool.status === "completed" && (
					<CheckCircle2 className="size-3 text-green-500 shrink-0" />
				)}
				{tool.status === "error" && (
					<XCircle className="size-3 text-destructive shrink-0" />
				)}
			</summary>
			{tool.output ? (
				<pre className="px-2 py-1.5 font-mono overflow-x-auto max-h-48 border-t bg-muted/20">
					<code className="text-foreground">
						{typeof tool.output === "string"
							? tool.output
							: JSON.stringify(tool.output, null, 2)}
					</code>
				</pre>
			) : null}
		</details>
	);
}

// =============================================================================
// Main Component
// =============================================================================

export function MessageBubble(props: MessageBubbleProps) {
	const isStreaming = props.variant === "streaming";

	// Normalize data from both message types
	const role = props.message.role;
	const isAI = role === "assistant";

	const segments: SegmentInfo[] =
		props.variant === "streaming"
			? props.message.segments
			: props.message.segments;

	const tools: ToolCallInfo[] =
		props.variant === "streaming"
			? props.message.tools
			: (props.message.toolCalls ?? []);

	const thought =
		props.variant === "streaming"
			? props.message.thought
			: props.message.thought;

	const activeSegmentIndex =
		props.variant === "streaming" ? props.message.activeSegmentIndex : -1;

	const timestamp =
		props.variant === "completed" ? props.message.timestamp : null;

	const interleavedContent = buildInterleavedContent(segments, tools);

	// Check if we have any content at all (for streaming empty state)
	const hasAnyContent =
		segments.some((s) => s.content.length > 0) || tools.length > 0;

	return (
		<div
			className={cn(
				"flex gap-3 py-3 px-4 transition-colors",
				isStreaming ? "bg-muted/20" : "hover:bg-muted/30",
			)}
		>
			<Avatar className="size-9 shrink-0 mt-0.5">
				<AvatarFallback
					className={cn(
						"text-xs font-medium",
						isAI
							? "bg-primary/20 text-primary"
							: "bg-muted text-muted-foreground",
					)}
				>
					{isAI ? "A" : "U"}
				</AvatarFallback>
			</Avatar>
			<div className="flex-1 min-w-0">
				{/* Header */}
				<div className="flex items-baseline gap-2 mb-1">
					<span className={cn("font-semibold text-sm", isAI && "text-primary")}>
						{isAI ? "Autarch" : "You"}
					</span>
					{isAI && (
						<Badge
							variant="secondary"
							className="text-[10px] px-1.5 py-0 h-4 bg-primary/10 text-primary"
						>
							AI
						</Badge>
					)}
					{isStreaming ? (
						<span className="text-xs text-muted-foreground flex items-center gap-1">
							<Loader2 className="size-3 animate-spin" />
							Thinking...
						</span>
					) : (
						timestamp && (
							<span className="text-xs text-muted-foreground">
								{formatTime(new Date(timestamp))}
							</span>
						)
					)}
				</div>

				{/* Interleaved segments and tools */}
				{interleavedContent.map((item) => {
					if (item.type === "segment") {
						const isActiveSegment = item.segment.index === activeSegmentIndex;
						const showCursor =
							isStreaming && isActiveSegment && !item.segment.isComplete;

						return item.segment.content ? (
							<div key={`segment-${item.segment.index}`} className="text-sm">
								<Markdown>{item.segment.content}</Markdown>
								{showCursor && (
									<span className="inline-block w-2 h-4 bg-primary/50 animate-pulse" />
								)}
							</div>
						) : showCursor ? (
							<span
								key={`segment-${item.segment.index}`}
								className="inline-block w-2 h-4 bg-primary/50 animate-pulse"
							/>
						) : null;
					}
					return (
						<div key={`tool-${item.tool.id}`} className="my-2">
							<ToolCallDisplay tool={item.tool} />
						</div>
					);
				})}

				{/* Show cursor when no content yet (streaming only) */}
				{isStreaming && !hasAnyContent && (
					<span className="inline-block w-2 h-4 bg-primary/50 animate-pulse" />
				)}

				{/* Extended thinking / reasoning */}
				{thought && (
					<details className="mt-3" open={isStreaming}>
						<summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
							{isStreaming ? "Reasoning..." : "View reasoning"}
						</summary>
						<div className="mt-2 pl-3 border-l-2 border-muted">
							<p className="text-xs text-muted-foreground italic whitespace-pre-wrap">
								{thought}
								{isStreaming && (
									<span className="inline-block w-1 h-3 bg-muted-foreground/50 animate-pulse ml-0.5" />
								)}
							</p>
						</div>
					</details>
				)}
			</div>
		</div>
	);
}

// =============================================================================
// Convenience Exports (for backward compatibility during migration)
// =============================================================================

export function StreamingMessageBubble({
	message,
}: {
	message: StreamingMessage;
}) {
	return <MessageBubble variant="streaming" message={message} />;
}

export function ChannelMessageBubble({ message }: { message: ChannelMessage }) {
	return <MessageBubble variant="completed" message={message} />;
}
