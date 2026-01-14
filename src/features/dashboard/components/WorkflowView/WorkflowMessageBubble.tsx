import {
	ChevronRight,
	FileText,
	GitBranch,
	ListTodo,
	Search,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { WorkflowMessage } from "../../types";
import { formatTime } from "../../utils";
import { Markdown } from "../Markdown";
import { statusConfig } from "./config";

interface WorkflowMessageBubbleProps {
	message: WorkflowMessage;
}

export function WorkflowMessageBubble({ message }: WorkflowMessageBubbleProps) {
	const phaseConfig = message.phase ? statusConfig[message.phase] : null;

	return (
		<div className="flex gap-3 py-3 px-4 hover:bg-muted/30 transition-colors">
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
					{phaseConfig && (
						<Badge
							variant="secondary"
							className={cn(
								"text-[10px] px-1.5 py-0 h-4",
								phaseConfig.bg,
								phaseConfig.color,
							)}
						>
							{phaseConfig.label}
						</Badge>
					)}
					<span className="text-xs text-muted-foreground">
						{formatTime(message.timestamp)}
					</span>
				</div>
				<Markdown className="text-sm">{message.content}</Markdown>
				{message.artifacts && message.artifacts.length > 0 && (
					<div className="mt-3 space-y-2">
						{message.artifacts.map((artifact, idx) => (
							<div
								key={`${artifact.title}-${idx}`}
								className="flex items-center gap-2 px-3 py-2 rounded-md border bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
							>
								{artifact.type === "plan" && (
									<ListTodo className="size-4 text-cyan-500" />
								)}
								{artifact.type === "code" && (
									<FileText className="size-4 text-blue-500" />
								)}
								{artifact.type === "diff" && (
									<GitBranch className="size-4 text-orange-500" />
								)}
								{artifact.type === "research" && (
									<Search className="size-4 text-purple-500" />
								)}
								<span className="text-sm font-medium flex-1">
									{artifact.title}
								</span>
								<ChevronRight className="size-4 text-muted-foreground" />
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
