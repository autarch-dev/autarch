import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
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

interface CreateWorkflowFormData {
	prompt: string;
}

interface CreateWorkflowDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onCreate: (prompt: string) => void;
}

export function CreateWorkflowDialog({
	open,
	onOpenChange,
	onCreate,
}: CreateWorkflowDialogProps) {
	const {
		register,
		handleSubmit,
		reset,
		formState: { isValid },
	} = useForm<CreateWorkflowFormData>({
		defaultValues: { prompt: "" },
		mode: "onChange",
	});

	useEffect(() => {
		if (!open) {
			reset();
		}
	}, [open, reset]);

	const onSubmit = (data: CreateWorkflowFormData) => {
		onCreate(data.prompt.trim());
		reset();
		onOpenChange(false);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<form onSubmit={handleSubmit(onSubmit)}>
					<DialogHeader>
						<DialogTitle>Create Workflow</DialogTitle>
						<DialogDescription>
							Describe what you want to build and Autarch will help you plan and
							execute it.
						</DialogDescription>
					</DialogHeader>

					<div className="my-6 space-y-2">
						<Label htmlFor="prompt">What do you want to build?</Label>
						<Textarea
							id="prompt"
							placeholder="e.g., Add user authentication with OAuth support"
							className="max-h-[400px] overflow-y-auto"
							rows={6}
							autoFocus
							{...register("prompt", { required: true })}
						/>
					</div>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={!isValid}>
							Create
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
