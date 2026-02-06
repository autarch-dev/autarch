import { useEffect, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CreateRoadmapFormData {
	title: string;
}

interface CreateRoadmapDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onCreate: (title: string, mode: "ai" | "blank") => Promise<void>;
}

export function CreateRoadmapDialog({
	open,
	onOpenChange,
	onCreate,
}: CreateRoadmapDialogProps) {
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const {
		register,
		handleSubmit,
		reset,
		formState: { isValid },
	} = useForm<CreateRoadmapFormData>({
		defaultValues: { title: "" },
		mode: "onChange",
	});

	useEffect(() => {
		if (!open) {
			reset();
			setError(null);
		}
	}, [open, reset]);

	const handleCreate = async (
		data: CreateRoadmapFormData,
		mode: "ai" | "blank",
	) => {
		setIsSubmitting(true);
		setError(null);

		try {
			await onCreate(data.title.trim(), mode);
			reset();
			onOpenChange(false);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to create roadmap");
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<form onSubmit={handleSubmit((data) => handleCreate(data, "blank"))}>
					<DialogHeader>
						<DialogTitle>Create Roadmap</DialogTitle>
						<DialogDescription>
							Create a new product roadmap. Start blank or let AI help you plan.
						</DialogDescription>
					</DialogHeader>

					<div className="my-6 space-y-2">
						<Label htmlFor="roadmap-title">Title</Label>
						<Input
							id="roadmap-title"
							placeholder="e.g., Q1 Product Roadmap"
							autoFocus
							{...register("title", { required: true })}
						/>
						{error && <p className="text-sm text-destructive">{error}</p>}
					</div>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
							disabled={isSubmitting}
						>
							Cancel
						</Button>
						<Button
							type="button"
							variant="secondary"
							disabled={!isValid || isSubmitting}
							onClick={handleSubmit((data) => handleCreate(data, "blank"))}
						>
							{isSubmitting ? "Creating..." : "Create Blank"}
						</Button>
						<Button
							type="button"
							disabled={!isValid || isSubmitting}
							onClick={handleSubmit((data) => handleCreate(data, "ai"))}
						>
							{isSubmitting ? "Creating..." : "Create with AI"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
