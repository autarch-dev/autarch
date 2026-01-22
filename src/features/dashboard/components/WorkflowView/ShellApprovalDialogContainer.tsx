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

	const handleApprove = async (approvalId: string, remember: boolean) => {
		try {
			const response = await fetch(`/api/shell-approval/${approvalId}/approve`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ remember }),
			});
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
			onApprove={handleApprove}
			onDeny={handleDeny}
		/>
	);
}
