/**
 * CredentialPromptDialogContainer - Renders credential prompt dialogs from store state
 *
 * This component subscribes to the pendingCredentialPrompts state and renders
 * a dialog for the first pending prompt. Place this at a high level in the
 * component tree to ensure the dialog is always visible.
 *
 * For sequential prompt handling (e.g., HTTPS username then password), the dialog
 * stays mounted and swaps prompt text when promptId changes, avoiding re-mount animation.
 */

import { useWorkflowsStore } from "../../store/workflowsStore";
import { CredentialPromptDialog } from "./CredentialPromptDialog";

export function CredentialPromptDialogContainer() {
	const pendingCredentialPrompts = useWorkflowsStore(
		(state) => state.pendingCredentialPrompts,
	);

	// Get the first pending prompt (if any)
	const firstPrompt = pendingCredentialPrompts.values().next().value;

	if (!firstPrompt) {
		return null;
	}

	const handleSubmit = async (promptId: string, credential: string) => {
		try {
			const response = await fetch(
				`/api/credential-prompt/${promptId}/respond`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ credential }),
				},
			);
			if (!response.ok) {
				const error = await response.text();
				console.error("Failed to submit credential:", error);
			}
		} catch (err) {
			console.error("Failed to submit credential:", err);
		}
	};

	const handleCancel = async (promptId: string) => {
		try {
			const response = await fetch(
				`/api/credential-prompt/${promptId}/respond`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ credential: null }),
				},
			);
			if (!response.ok) {
				const error = await response.text();
				console.error("Failed to cancel credential prompt:", error);
			}
		} catch (err) {
			console.error("Failed to cancel credential prompt:", err);
		}
	};

	return (
		<CredentialPromptDialog
			promptId={firstPrompt.promptId}
			prompt={firstPrompt.prompt}
			onSubmit={handleSubmit}
			onCancel={handleCancel}
		/>
	);
}
