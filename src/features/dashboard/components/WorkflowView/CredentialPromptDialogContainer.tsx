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

import { useEffect, useState } from "react";
import { useWorkflowsStore } from "../../store/workflowsStore";
import { CredentialPromptDialog } from "./CredentialPromptDialog";

export function CredentialPromptDialogContainer() {
	const pendingCredentialPrompts = useWorkflowsStore(
		(state) => state.pendingCredentialPrompts,
	);
	const [error, setError] = useState<string | null>(null);

	// Get the first pending prompt (if any)
	const firstPrompt = pendingCredentialPrompts.values().next().value;

	// Clear error when the prompt changes (new prompt or prompt resolved)
	const currentPromptId = firstPrompt?.promptId;
	// biome-ignore lint/correctness/useExhaustiveDependencies: Intentionally reset error when promptId changes
	useEffect(() => {
		setError(null);
	}, [currentPromptId]);

	if (!firstPrompt) {
		return null;
	}

	const handleSubmit = async (promptId: string, credential: string) => {
		setError(null);
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
				const errorBody = await response.json();
				console.error("Failed to submit credential:", errorBody.error);
				setError("Failed to submit credential. The prompt may have expired.");
			}
		} catch (err) {
			console.error("Failed to submit credential:", err);
			setError("Failed to submit credential. Please try again.");
		}
	};

	const handleCancel = async (promptId: string) => {
		setError(null);
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
				const errorBody = await response.json();
				console.error("Failed to cancel credential prompt:", errorBody.error);
				setError("Failed to cancel prompt. The prompt may have expired.");
			}
		} catch (err) {
			console.error("Failed to cancel credential prompt:", err);
			setError("Failed to cancel prompt. Please try again.");
		}
	};

	return (
		<CredentialPromptDialog
			promptId={firstPrompt.promptId}
			prompt={firstPrompt.prompt}
			error={error}
			onSubmit={handleSubmit}
			onCancel={handleCancel}
		/>
	);
}
