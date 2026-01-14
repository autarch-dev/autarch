import { TooltipProvider } from "@/components/ui/tooltip";
import type { Workflow, WorkflowMessage } from "../../types";
import { MessageInput } from "../MessageInput";
import { WorkflowEmptyState } from "./WorkflowEmptyState";
import { WorkflowHeader } from "./WorkflowHeader";
import { WorkflowMessageBubble } from "./WorkflowMessageBubble";

interface WorkflowViewProps {
	workflow: Workflow;
	messages: WorkflowMessage[];
	onSendMessage?: (content: string) => void;
}

export function WorkflowView({
	workflow,
	messages,
	onSendMessage,
}: WorkflowViewProps) {
	return (
		<TooltipProvider>
			<div className="flex flex-col h-full">
				<WorkflowHeader workflow={workflow} />

				<div className="flex-1 overflow-y-auto min-h-0">
					<div className="py-2">
						{messages.length === 0 ? (
							<WorkflowEmptyState />
						) : (
							messages.map((message) => (
								<WorkflowMessageBubble key={message.id} message={message} />
							))
						)}
					</div>
				</div>

				<div className="shrink-0 p-4 border-t bg-background">
					<MessageInput
						placeholder="Describe your task or ask a question..."
						onSend={onSendMessage}
					/>
				</div>
			</div>
		</TooltipProvider>
	);
}
