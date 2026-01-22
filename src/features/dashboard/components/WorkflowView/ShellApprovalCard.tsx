/**
 * ShellApprovalDialog - Modal dialog for shell command approval
 *
 * Shows the command and agent's reason in a prominent dialog,
 * with approve/deny buttons. Includes option to remember approval
 * for exact command matches in workflow.
 */

import { CheckCircle, Terminal, XCircle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
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

interface ShellApprovalDialogProps {
	approvalId: string;
	command: string;
	reason: string;
	onApprove: (approvalId: string, remember: boolean) => Promise<void>;
	onDeny: (approvalId: string, reason: string) => Promise<void>;
}

/**
 * @deprecated Use ShellApprovalDialog instead
 */
export function ShellApprovalCard(props: ShellApprovalDialogProps) {
	return <ShellApprovalDialog {...props} />;
}

export function ShellApprovalDialog({
	approvalId,
	command,
	reason,
	onApprove,
	onDeny,
}: ShellApprovalDialogProps) {
	const [view, setView] = useState<"approve" | "deny">("approve");
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
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Dialog open={true} onOpenChange={() => {}}>
			<DialogContent
				className="sm:max-w-lg"
				onPointerDownOutside={(e) => e.preventDefault()}
				onEscapeKeyDown={(e) => e.preventDefault()}
			>
				<DialogHeader>
					<div className="flex items-center gap-2">
						<Terminal className="size-5 text-primary" />
						<DialogTitle>Shell Command Approval Required</DialogTitle>
					</div>
					<DialogDescription>
						The agent wants to execute the following command. Review and approve
						or deny.
					</DialogDescription>
				</DialogHeader>

				{view === "approve" ? (
					<>
						{/* Command display */}
						<div className="rounded-md bg-muted p-3 my-2">
							<code className="text-sm font-mono whitespace-pre-wrap break-all">
								{command}
							</code>
						</div>

						{/* Agent's reason */}
						<p className="text-sm text-muted-foreground">{reason}</p>

						{/* Remember checkbox */}
						<div className="flex items-center gap-2 mt-2">
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
										Remember for this workflow
									</Label>
								</TooltipTrigger>
								<TooltipContent side="right" className="max-w-xs">
									When enabled, this exact command will be auto-approved for the
									remainder of this workflow. Only exact matches are remembered.
								</TooltipContent>
							</Tooltip>
						</div>

						<DialogFooter className="mt-4">
							<Button
								variant="outline"
								onClick={() => setView("deny")}
								disabled={isSubmitting}
								className="text-destructive hover:text-destructive"
							>
								<XCircle className="size-4 mr-1" />
								Deny
							</Button>
							<Button onClick={handleApprove} disabled={isSubmitting}>
								<CheckCircle className="size-4 mr-1" />
								Approve
							</Button>
						</DialogFooter>
					</>
				) : (
					<>
						{/* Deny view */}
						<div className="py-2">
							<p className="text-sm text-muted-foreground mb-3">
								Provide a reason for denying this command. The agent will
								receive this feedback and may try an alternative approach.
							</p>
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
								onClick={() => {
									setView("approve");
									setDenyReason("");
								}}
								disabled={isSubmitting}
							>
								Back
							</Button>
							<Button
								variant="destructive"
								onClick={handleDeny}
								disabled={isSubmitting || !denyReason.trim()}
							>
								Deny Command
							</Button>
						</DialogFooter>
					</>
				)}
			</DialogContent>
		</Dialog>
	);
}
