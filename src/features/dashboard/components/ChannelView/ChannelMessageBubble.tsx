import { FileCode } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Message } from "../../types";
import { formatTime } from "../../utils";
import { Markdown } from "../Markdown";

interface ChannelMessageBubbleProps {
	message: Message;
}

export function ChannelMessageBubble({ message }: ChannelMessageBubbleProps) {
	return (
		<div
			className={cn("flex gap-3 py-3 px-4 hover:bg-muted/30 transition-colors")}
		>
			<Avatar className="size-9 shrink-0 mt-0.5">
				<AvatarFallback
					className={cn(
						"text-xs font-medium",
						message.isAI
							? "bg-primary/20 text-primary"
							: "bg-muted text-muted-foreground",
					)}
				>
					{message.isAI ? "A" : message.author.name.charAt(0)}
				</AvatarFallback>
			</Avatar>
			<div className="flex-1 min-w-0">
				<div className="flex items-baseline gap-2 mb-1">
					<span
						className={cn(
							"font-semibold text-sm",
							message.isAI && "text-primary",
						)}
					>
						{message.author.name}
					</span>
					{message.isAI && (
						<Badge
							variant="secondary"
							className="text-[10px] px-1.5 py-0 h-4 bg-primary/10 text-primary"
						>
							AI
						</Badge>
					)}
					<span className="text-xs text-muted-foreground">
						{formatTime(message.timestamp)}
					</span>
				</div>
				<Markdown className="text-sm">{message.content}</Markdown>
				{message.codeReferences && message.codeReferences.length > 0 && (
					<div className="mt-3 space-y-2">
						{message.codeReferences.map((ref, idx) => (
							<div
								key={`${ref.file}-${idx}`}
								className="rounded-md border bg-muted/50 overflow-hidden"
							>
								<div className="flex items-center gap-2 px-3 py-1.5 border-b bg-muted/70">
									<FileCode className="size-3.5 text-muted-foreground" />
									<span className="text-xs font-mono text-muted-foreground">
										{ref.file}
									</span>
									<span className="text-xs text-muted-foreground">
										:{ref.startLine}-{ref.endLine}
									</span>
								</div>
								<pre className="px-3 py-2 text-xs font-mono overflow-x-auto">
									<code className="text-foreground">{ref.snippet}</code>
								</pre>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
