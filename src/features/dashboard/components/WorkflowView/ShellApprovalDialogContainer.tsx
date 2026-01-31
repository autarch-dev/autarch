/**
 * ShellApprovalDialogContainer - Renders shell approval dialogs from store state
 *
 * This component subscribes to the pendingShellApprovals state and renders
 * a dialog for the first pending approval. Place this at a high level in the
 * component tree to ensure the dialog is always visible.
 */

import { useWorkflowsStore } from "../../store/workflowsStore";
import { ShellApprovalDialog } from "./ShellApprovalCard";

export function ShellApprovalDialogContainer() {
	const pendingShellApprovals = useWorkflowsStore(
		(state) => state.pendingShellApprovals,
	);

	// Get the first pending approval (if any)
	const firstApproval = pendingShellApprovals.values().next().value;

	if (!firstApproval) {
		return null;
	}

	// Check if we're in preflight mode from the approval event payload
	const isPreflight = firstApproval.agentRole === "preflight";

	const handleApprove = async (
		approvalId: string,
		options: { remember: boolean; persistForProject: boolean },
	) => {
		try {
			const response = await fetch(
				`/api/shell-approval/${approvalId}/approve`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						remember: options.remember,
						persistForProject: options.persistForProject,
					}),
				},
			);
			if (!response.ok) {
				const error = await response.json();
				console.error("Failed to approve shell command:", error);
			}
		} catch (err) {
			console.error("Failed to approve shell command:", err);
		}
	};

	const handleDeny = async (approvalId: string, reason: string) => {
		try {
			const response = await fetch(`/api/shell-approval/${approvalId}/deny`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ reason }),
			});
			if (!response.ok) {
				const error = await response.json();
				console.error("Failed to deny shell command:", error);
			}
		} catch (err) {
			console.error("Failed to deny shell command:", err);
		}
	};

	return (
		<ShellApprovalDialog
			approvalId={firstApproval.approvalId}
			command={firstApproval.command}
			reason={firstApproval.reason}
			isPreflight={isPreflight}
			onApprove={handleApprove}
			onDeny={handleDeny}
		/>
	);
}
