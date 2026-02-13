import {
	AtSign,
	Bold,
	Code,
	Italic,
	List,
	Paperclip,
	Send,
	Sparkles,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
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
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	const applyFormatting = useCallback(
		(type: "bold" | "italic" | "code" | "list") => {
			const textarea = textareaRef.current;
			if (!textarea) return;

			const start = textarea.selectionStart;
			const end = textarea.selectionEnd;
			const selected = message.slice(start, end);

			let before: string;
			let after: string;
			let cursorOffset: number;

			switch (type) {
				case "bold": {
					const text = selected || "bold";
					before = `${message.slice(0, start)}**${text}**`;
					after = message.slice(end);
					cursorOffset = selected ? start + text.length + 4 : start + 2;
					break;
				}
				case "italic": {
					const text = selected || "italic";
					before = `${message.slice(0, start)}*${text}*`;
					after = message.slice(end);
					cursorOffset = selected ? start + text.length + 2 : start + 1;
					break;
				}
				case "code": {
					const text = selected || "code";
					before = `${message.slice(0, start)}\`${text}\``;
					after = message.slice(end);
					cursorOffset = selected ? start + text.length + 2 : start + 1;
					break;
				}
				case "list": {
					const lineStart = message.lastIndexOf("\n", start - 1) + 1;
					before = `${message.slice(0, lineStart)}- ${message.slice(lineStart, end)}`;
					after = message.slice(end);
					cursorOffset = end + 2;
					break;
				}
			}

			const newMessage = before + after;
			setMessage(newMessage);

			requestAnimationFrame(() => {
				textarea.focus();
				if (type !== "list" && !selected) {
					const placeholder =
						type === "bold" ? "bold" : type === "italic" ? "italic" : "code";
					textarea.setSelectionRange(
						cursorOffset,
						cursorOffset + placeholder.length,
					);
				} else {
					textarea.setSelectionRange(cursorOffset, cursorOffset);
				}
			});
		},
		[message],
	);

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
				<Textarea
					ref={textareaRef}
					value={message}
					onChange={(e) => setMessage(e.target.value)}
					onKeyDown={handleKeyDown}
					placeholder={placeholder}
					disabled={disabled}
					className="min-h-[60px] max-h-[200px] resize-none border-0 px-3 py-3 focus-visible:ring-0 focus-visible:ring-offset-0"
				/>
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
								<Button
									variant="ghost"
									size="icon-sm"
									disabled={disabled}
									onClick={() => applyFormatting("bold")}
								>
									<Bold className="size-4" />
								</Button>
							</TooltipTrigger>
							<TooltipContent>Bold</TooltipContent>
						</Tooltip>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="ghost"
									size="icon-sm"
									disabled={disabled}
									onClick={() => applyFormatting("italic")}
								>
									<Italic className="size-4" />
								</Button>
							</TooltipTrigger>
							<TooltipContent>Italic</TooltipContent>
						</Tooltip>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="ghost"
									size="icon-sm"
									disabled={disabled}
									onClick={() => applyFormatting("code")}
								>
									<Code className="size-4" />
								</Button>
							</TooltipTrigger>
							<TooltipContent>Insert code</TooltipContent>
						</Tooltip>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="ghost"
									size="icon-sm"
									disabled={disabled}
									onClick={() => applyFormatting("list")}
								>
									<List className="size-4" />
								</Button>
							</TooltipTrigger>
							<TooltipContent>List</TooltipContent>
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
