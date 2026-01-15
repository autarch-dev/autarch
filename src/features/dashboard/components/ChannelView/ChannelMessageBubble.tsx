import { CheckCircle2, Loader2, Wrench, XCircle } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ChannelMessage } from "@/shared/schemas/channel";
import { formatTime } from "../../utils";
import { Markdown } from "../Markdown";

interface ChannelMessageBubbleProps {
	message: ChannelMessage;
}

export function ChannelMessageBubble({ message }: ChannelMessageBubbleProps) {
	const isAI = message.role === "assistant";

	return (
		<div
			className={cn("flex gap-3 py-3 px-4 hover:bg-muted/30 transition-colors")}
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
					<span className="text-xs text-muted-foreground">
						{formatTime(new Date(message.timestamp))}
					</span>
				</div>

				{/* Message content */}
				{message.content && (
					<Markdown className="text-sm">{message.content}</Markdown>
				)}

				{/* Tool calls */}
				{message.toolCalls && message.toolCalls.length > 0 && (
					<div className="mt-3 space-y-2">
						{message.toolCalls.map((tool) => (
							<ToolCallDisplay key={tool.id} tool={tool} />
						))}
					</div>
				)}

				{/* Extended thinking */}
				{message.thought && (
					<details className="mt-3">
						<summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
							View reasoning
						</summary>
						<div className="mt-2 pl-3 border-l-2 border-muted">
							<p className="text-xs text-muted-foreground italic whitespace-pre-wrap">
								{message.thought}
							</p>
						</div>
					</details>
				)}
			</div>
		</div>
	);
}

interface ToolCallDisplayProps {
	tool: {
		id: string;
		name: string;
		input: unknown;
		output?: unknown;
		status: "running" | "completed" | "error";
	};
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

function ToolCallDisplay({ tool }: ToolCallDisplayProps) {
	const reason = getToolReason(tool.input);

	return (
		<div className="rounded-md border bg-muted/50 overflow-hidden">
			<div className="flex items-center gap-2 px-3 py-1.5 border-b bg-muted/70">
				<Wrench className="size-3.5 text-muted-foreground shrink-0" />
				<div className="flex-1 min-w-0">
					<span className="text-xs font-mono text-muted-foreground">
						{tool.name}
					</span>
					{reason && (
						<p className="text-xs text-muted-foreground/70 truncate">
							{reason}
						</p>
					)}
				</div>
				{tool.status === "running" && (
					<Loader2 className="size-3 animate-spin text-muted-foreground shrink-0" />
				)}
				{tool.status === "completed" && (
					<CheckCircle2 className="size-3 text-green-500 shrink-0" />
				)}
				{tool.status === "error" && (
					<XCircle className="size-3 text-destructive shrink-0" />
				)}
			</div>
			{tool.output ? (
				<pre className="px-3 py-2 text-xs font-mono overflow-x-auto max-h-32">
					<code className="text-foreground">
						{typeof tool.output === "string"
							? tool.output
							: JSON.stringify(tool.output, null, 2)}
					</code>
				</pre>
			) : null}
		</div>
	);
}
