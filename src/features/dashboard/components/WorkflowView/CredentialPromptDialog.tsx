/**
 * CredentialPromptDialog - Modal dialog for git credential input
 *
 * Shows the prompt text from git/ssh operations and provides a password
 * input for the user to enter credentials. Prevents dismissal via
 * escape or outside click to ensure the user explicitly submits or cancels.
 */

import { Lock } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface CredentialPromptDialogProps {
	promptId: string;
	prompt: string;
	onSubmit: (promptId: string, credential: string) => Promise<void>;
	onCancel: (promptId: string) => Promise<void>;
}

export function CredentialPromptDialog({
	promptId,
	prompt,
	onSubmit,
	onCancel,
}: CredentialPromptDialogProps) {
	const [inputValue, setInputValue] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);

	// biome-ignore lint/correctness/useExhaustiveDependencies: Intentionally reset input when promptId changes (e.g., HTTPS username → password)
	useEffect(() => {
		setInputValue("");
	}, [promptId]);

	const handleSubmit = async () => {
		if (!inputValue || isSubmitting) return;
		setIsSubmitting(true);
		try {
			await onSubmit(promptId, inputValue);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleCancel = async () => {
		if (isSubmitting) return;
		setIsSubmitting(true);
		try {
			await onCancel(promptId);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter" && inputValue && !isSubmitting) {
			handleSubmit();
		}
	};

	return (
		<Dialog open={true} onOpenChange={() => {}}>
			<DialogContent
				className="sm:max-w-lg"
				onEscapeKeyDown={(e) => e.preventDefault()}
				onPointerDownOutside={(e) => e.preventDefault()}
				onInteractOutside={(e) => e.preventDefault()}
			>
				<DialogHeader>
					<div className="flex items-center gap-2">
						<Lock className="size-5 text-primary" />
						<DialogTitle>Credential Required</DialogTitle>
					</div>
					<DialogDescription>{prompt}</DialogDescription>
				</DialogHeader>

				<div className="py-2">
					<Input
						type="password"
						value={inputValue}
						onChange={(e) => setInputValue(e.target.value)}
						onKeyDown={handleKeyDown}
						placeholder="Enter credential..."
						disabled={isSubmitting}
						autoFocus
					/>
				</div>

				<DialogFooter>
					<Button
						variant="outline"
						onClick={handleCancel}
						disabled={isSubmitting}
					>
						Cancel
					</Button>
					<Button onClick={handleSubmit} disabled={!inputValue || isSubmitting}>
						Submit
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
