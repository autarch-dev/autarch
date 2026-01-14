import { AtSign, Code, Paperclip, Send, Sparkles } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface MessageInputProps {
	placeholder?: string;
	onSend?: (message: string) => void;
	disabled?: boolean;
	showAIToggle?: boolean;
}

export function MessageInput({
	placeholder = "Message...",
	onSend,
	disabled = false,
	showAIToggle = true,
}: MessageInputProps) {
	const [message, setMessage] = useState("");
	const [aiMode, setAiMode] = useState(true);

	const handleSend = () => {
		if (message.trim() && onSend) {
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
		<TooltipProvider>
			<div className="border rounded-lg bg-background">
				<div className="p-3">
					<Textarea
						value={message}
						onChange={(e) => setMessage(e.target.value)}
						onKeyDown={handleKeyDown}
						placeholder={placeholder}
						disabled={disabled}
						className="min-h-[60px] max-h-[200px] resize-none border-0 p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
					/>
				</div>
				<div className="flex items-center justify-between px-3 py-2 border-t bg-muted/30">
					<div className="flex items-center gap-1">
						<Tooltip>
							<TooltipTrigger asChild>
								<Button variant="ghost" size="icon-sm" disabled={disabled}>
									<Paperclip className="size-4" />
								</Button>
							</TooltipTrigger>
							<TooltipContent>Attach file</TooltipContent>
						</Tooltip>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button variant="ghost" size="icon-sm" disabled={disabled}>
									<AtSign className="size-4" />
								</Button>
							</TooltipTrigger>
							<TooltipContent>Mention file or symbol</TooltipContent>
						</Tooltip>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button variant="ghost" size="icon-sm" disabled={disabled}>
									<Code className="size-4" />
								</Button>
							</TooltipTrigger>
							<TooltipContent>Insert code block</TooltipContent>
						</Tooltip>
					</div>
					<div className="flex items-center gap-2">
						{showAIToggle && (
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										variant={aiMode ? "secondary" : "ghost"}
										size="sm"
										onClick={() => setAiMode(!aiMode)}
										className={cn(
											"h-7 gap-1.5",
											aiMode &&
												"bg-primary/10 text-primary hover:bg-primary/20",
										)}
									>
										<Sparkles className="size-3.5" />
										<span className="text-xs">AI</span>
									</Button>
								</TooltipTrigger>
								<TooltipContent>
									{aiMode ? "AI will respond" : "Note only (no AI response)"}
								</TooltipContent>
							</Tooltip>
						)}
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
			</div>
		</TooltipProvider>
	);
}
