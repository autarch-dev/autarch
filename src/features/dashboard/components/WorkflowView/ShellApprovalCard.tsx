/**
 * ShellApprovalCard - Display inline shell command approval UI
 *
 * Shows the command and agent's reason, with approve/deny buttons.
 * Includes option to remember approval for exact command matches in workflow.
 */

import { CheckCircle, Terminal, XCircle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";

interface ShellApprovalCardProps {
	approvalId: string;
	command: string;
	reason: string;
	onApprove: (approvalId: string, remember: boolean) => Promise<void>;
	onDeny: (approvalId: string, reason: string) => Promise<void>;
}

export function ShellApprovalCard({
	approvalId,
	command,
	reason,
	onApprove,
	onDeny,
}: ShellApprovalCardProps) {
	const [denyDialogOpen, setDenyDialogOpen] = useState(false);
	const [denyReason, setDenyReason] = useState("");
	const [rememberApproval, setRememberApproval] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const handleApprove = async () => {
		setIsSubmitting(true);
		try {
			await onApprove(approvalId, rememberApproval);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleDeny = async () => {
		if (!denyReason.trim()) return;
		setIsSubmitting(true);
		try {
			await onDeny(approvalId, denyReason.trim());
			setDenyDialogOpen(false);
			setDenyReason("");
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<>
			<Card className="mx-4 my-4 border-primary/50 bg-primary/5">
				<CardHeader className="pb-3">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<Terminal className="size-5 text-primary" />
							<CardTitle className="text-lg">
								Shell Command Approval Required
							</CardTitle>
						</div>
						<div className="flex items-center gap-2">
							<Button
								variant="outline"
								size="sm"
								onClick={() => setDenyDialogOpen(true)}
								disabled={isSubmitting}
								className="text-destructive hover:text-destructive"
							>
								<XCircle className="size-4 mr-1" />
								Deny
							</Button>
							<Button size="sm" onClick={handleApprove} disabled={isSubmitting}>
								<CheckCircle className="size-4 mr-1" />
								Approve
							</Button>
						</div>
					</div>
				</CardHeader>

				<CardContent className="space-y-4 pt-0">
					{/* Command display */}
					<div className="rounded-md bg-muted p-3">
						<code className="text-sm font-mono whitespace-pre-wrap break-all">
							{command}
						</code>
					</div>

					{/* Agent's reason */}
					<p className="text-sm text-muted-foreground">{reason}</p>

					{/* Remember checkbox */}
					<div className="flex items-center gap-2">
						<Checkbox
							id={`remember-${approvalId}`}
							checked={rememberApproval}
							onCheckedChange={(checked) =>
								setRememberApproval(checked === true)
							}
							disabled={isSubmitting}
						/>
						<Tooltip>
							<TooltipTrigger asChild>
								<Label
									htmlFor={`remember-${approvalId}`}
									className="text-sm cursor-pointer"
								>
									Approve and remember for this workflow
								</Label>
							</TooltipTrigger>
							<TooltipContent side="right" className="max-w-xs">
								When enabled, this exact command will be auto-approved for the
								remainder of this workflow. Only exact matches are remembered.
							</TooltipContent>
						</Tooltip>
					</div>
				</CardContent>
			</Card>

			{/* Deny Dialog */}
			<Dialog open={denyDialogOpen} onOpenChange={setDenyDialogOpen}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Deny Shell Command</DialogTitle>
						<DialogDescription>
							Provide a reason for denying this command. The agent will receive
							this feedback and may try an alternative approach.
						</DialogDescription>
					</DialogHeader>
					<div className="py-4">
						<Textarea
							value={denyReason}
							onChange={(e) => setDenyReason(e.target.value)}
							placeholder="e.g., This command could modify production data..."
							rows={4}
							autoFocus
						/>
					</div>
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => setDenyDialogOpen(false)}
							disabled={isSubmitting}
						>
							Cancel
						</Button>
						<Button
							variant="destructive"
							onClick={handleDeny}
							disabled={isSubmitting || !denyReason.trim()}
						>
							Deny Command
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
