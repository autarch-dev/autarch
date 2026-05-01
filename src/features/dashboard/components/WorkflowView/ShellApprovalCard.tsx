/**
 * ShellApprovalDialog - Modal dialog for shell command approval
 *
 * Shows the command and agent's reason in a prominent dialog,
 * with approve/deny buttons. Includes option to remember approval
 * for exact command matches in workflow.
 */

import { AlertTriangle, CheckCircle, Terminal, XCircle } from "lucide-react";
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
	isPreflight: boolean;
	/** Set when the command matched a hard-block pattern. The dialog shows
	 * a destructive warning banner with this label. */
	hardBlockLabel?: string;
	/** Set when auto mode's judge returned REVIEW. Shown so the user
	 * understands why the judge bounced the command back. */
	judgeReasoning?: string;
	onApprove: (
		approvalId: string,
		options: { remember: boolean; persistForProject: boolean },
	) => Promise<void>;
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
	isPreflight,
	hardBlockLabel,
	judgeReasoning,
	onApprove,
	onDeny,
}: ShellApprovalDialogProps) {
	const [view, setView] = useState<"approve" | "deny">("approve");
	const [denyReason, setDenyReason] = useState("");
	const [rememberApproval, setRememberApproval] = useState(false);
	const [persistForProject, setPersistForProject] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const handleApprove = async () => {
		setIsSubmitting(true);
		try {
			await onApprove(approvalId, {
				remember: rememberApproval,
				persistForProject,
			});
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
						{/* Hard-block warning banner */}
						{hardBlockLabel && (
							<div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 my-2 flex items-start gap-2">
								<AlertTriangle className="size-4 text-destructive shrink-0 mt-0.5" />
								<div className="text-sm">
									<p className="font-semibold text-destructive">
										Destructive command detected: {hardBlockLabel}
									</p>
									<p className="text-destructive/80 mt-1 text-xs">
										This command matches a pattern that can cause irreversible
										damage. It requires manual approval regardless of your shell
										approval mode.
									</p>
								</div>
							</div>
						)}

						{/* Command display */}
						<div className="rounded-md bg-muted p-3 my-2 max-h-[50vh] overflow-y-auto">
							<code className="text-sm font-mono whitespace-pre-wrap break-all">
								{command}
							</code>
						</div>

						{/* Agent's reason */}
						<p className="text-sm text-muted-foreground">{reason}</p>

						{/* Judge's reasoning (auto mode REVIEW) */}
						{judgeReasoning && (
							<div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2.5 mt-2 text-xs">
								<p className="text-amber-700 dark:text-amber-400 font-medium mb-0.5">
									Auto-approval gate flagged this for review
								</p>
								<p className="text-muted-foreground">{judgeReasoning}</p>
							</div>
						)}

						{/* Remember checkbox */}
						<div className="flex items-center gap-2 mt-2">
							<Checkbox
								id={`remember-${approvalId}`}
								checked={rememberApproval}
								onCheckedChange={(checked) => {
									const isChecked = checked === true;
									setRememberApproval(isChecked);
									// If unchecking remember, also uncheck persistent
									if (!isChecked) {
										setPersistForProject(false);
									}
								}}
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

						{/* Persistent approval checkbox - only visible during preflight */}
						{isPreflight && (
							<div className="flex items-center gap-2 mt-2">
								<Checkbox
									id={`persist-${approvalId}`}
									checked={persistForProject}
									onCheckedChange={(checked) =>
										setPersistForProject(checked === true)
									}
									disabled={isSubmitting || !rememberApproval}
								/>
								<Tooltip>
									<TooltipTrigger asChild>
										<Label
											htmlFor={`persist-${approvalId}`}
											className={`text-sm cursor-pointer ${
												!rememberApproval ? "text-muted-foreground" : ""
											}`}
										>
											Always allow during Preflight
										</Label>
									</TooltipTrigger>
									<TooltipContent side="right" className="max-w-xs">
										When enabled, this exact command will be auto-approved for
										all future workflows in this project. Requires "Remember for
										this workflow" to be checked first.
									</TooltipContent>
								</Tooltip>
							</div>
						)}

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
