import { Send } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface MessageInputProps {
	placeholder?: string;
	onSend?: (message: string) => void;
	disabled?: boolean;
}

export function MessageInput({
	placeholder = "Message...",
	onSend,
	disabled = false,
}: MessageInputProps) {
	const [message, setMessage] = useState("");

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
		<div className="border rounded-lg bg-background">
			<Textarea
				value={message}
				onChange={(e) => setMessage(e.target.value)}
				onKeyDown={handleKeyDown}
				placeholder={placeholder}
				disabled={disabled}
				className="min-h-[60px] max-h-[200px] resize-none border-0 px-3 py-3 focus-visible:ring-0 focus-visible:ring-offset-0"
			/>
			<div className="flex items-center justify-end px-3 py-2 border-t bg-muted/30">
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
	);
}
