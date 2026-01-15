import { CheckCircle2, Loader2, Wrench, XCircle } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { StreamingMessage } from "../../store/discussionsStore";
import { Markdown } from "../Markdown";

interface StreamingMessageBubbleProps {
	message: StreamingMessage;
}

export function StreamingMessageBubble({
	message,
}: StreamingMessageBubbleProps) {
	return (
		<div className="flex gap-3 py-3 px-4 bg-muted/20">
			<Avatar className="size-9 shrink-0 mt-0.5">
				<AvatarFallback className="text-xs font-medium bg-primary/20 text-primary">
					A
				</AvatarFallback>
			</Avatar>
			<div className="flex-1 min-w-0">
				<div className="flex items-baseline gap-2 mb-1">
					<span className="font-semibold text-sm text-primary">Autarch</span>
					<Badge
						variant="secondary"
						className="text-[10px] px-1.5 py-0 h-4 bg-primary/10 text-primary"
					>
						AI
					</Badge>
					<span className="text-xs text-muted-foreground flex items-center gap-1">
						<Loader2 className="size-3 animate-spin" />
						Thinking...
					</span>
				</div>

				{/* Streaming content */}
				{message.content && (
					<Markdown className="text-sm">{message.content}</Markdown>
				)}

				{/* Show cursor when no content yet */}
				{!message.content && message.tools.length === 0 && (
					<span className="inline-block w-2 h-4 bg-primary/50 animate-pulse" />
				)}

				{/* Active tool calls */}
				{message.tools.length > 0 && (
					<div className="mt-3 space-y-2">
						{message.tools.map((tool) => (
							<StreamingToolCall key={tool.id} tool={tool} />
						))}
					</div>
				)}

				{/* Extended thinking (collapsible) */}
				{message.thought && (
					<details className="mt-3" open>
						<summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
							Reasoning...
						</summary>
						<div className="mt-2 pl-3 border-l-2 border-muted">
							<p className="text-xs text-muted-foreground italic whitespace-pre-wrap">
								{message.thought}
								<span className="inline-block w-1 h-3 bg-muted-foreground/50 animate-pulse ml-0.5" />
							</p>
						</div>
					</details>
				)}
			</div>
		</div>
	);
}

interface StreamingToolCallProps {
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

function StreamingToolCall({ tool }: StreamingToolCallProps) {
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
