import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { Workflow } from "@/shared/schemas/workflow";
import {
	WORKFLOW_STATUS_COLORS,
	WORKFLOW_STATUS_LABELS,
} from "@/shared/schemas/workflow";

interface LinkWorkflowDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	workflows: Workflow[];
	onLink: (workflowId: string) => Promise<void>;
}

export function LinkWorkflowDialog({
	open,
	onOpenChange,
	workflows,
	onLink,
}: LinkWorkflowDialogProps) {
	const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(
		null,
	);
	const [isLinking, setIsLinking] = useState(false);

	// Reset selection and linking state when dialog opens
	useEffect(() => {
		if (open) {
			setSelectedWorkflowId(null);
			setIsLinking(false);
		}
	}, [open]);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Link to Existing Workflow</DialogTitle>
					<DialogDescription>
						Select a workflow to link to this initiative.
					</DialogDescription>
				</DialogHeader>

				{workflows.length === 0 ? (
					<p className="text-center text-sm text-muted-foreground py-6">
						No available workflows to link.
					</p>
				) : (
					<ScrollArea className="max-h-[300px] space-y-1">
						{workflows.map((w) => (
							<button
								key={w.id}
								type="button"
								className={cn(
									"flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent",
									selectedWorkflowId === w.id && "bg-accent ring-1 ring-ring",
								)}
								onClick={() => setSelectedWorkflowId(w.id)}
							>
								<span className="truncate mr-2">{w.title}</span>
								<Badge
									variant="secondary"
									className={cn(
										"text-xs shrink-0",
										WORKFLOW_STATUS_COLORS[w.status],
									)}
								>
									{WORKFLOW_STATUS_LABELS[w.status]}
								</Badge>
							</button>
						))}
					</ScrollArea>
				)}

				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button
						disabled={selectedWorkflowId === null || isLinking}
						onClick={async () => {
							if (selectedWorkflowId) {
								setIsLinking(true);
								try {
									await onLink(selectedWorkflowId);
								} finally {
									setIsLinking(false);
								}
							}
						}}
					>
						{isLinking ? "Linking\u2026" : "Link"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
