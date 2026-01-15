import { zodResolver } from "@hookform/resolvers/zod";
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
import { Textarea } from "@/components/ui/textarea";
import {
	type CreateChannelRequest,
	CreateChannelRequestSchema,
} from "@/shared/schemas/channel";

interface CreateChannelDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onCreate: (name: string, description?: string) => Promise<void>;
}

export function CreateChannelDialog({
	open,
	onOpenChange,
	onCreate,
}: CreateChannelDialogProps) {
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const {
		register,
		handleSubmit,
		reset,
		formState: { errors, isValid },
	} = useForm<CreateChannelRequest>({
		resolver: zodResolver(CreateChannelRequestSchema),
		defaultValues: { name: "", description: "" },
		mode: "onChange",
	});

	useEffect(() => {
		if (!open) {
			reset();
			setError(null);
		}
	}, [open, reset]);

	const onSubmit = async (data: CreateChannelRequest) => {
		setIsSubmitting(true);
		setError(null);

		try {
			await onCreate(data.name, data.description);
			reset();
			onOpenChange(false);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to create channel");
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<form onSubmit={handleSubmit(onSubmit)}>
					<DialogHeader>
						<DialogTitle>Create Channel</DialogTitle>
						<DialogDescription>
							Create a new discussion channel to chat with Autarch about your
							codebase.
						</DialogDescription>
					</DialogHeader>

					<div className="my-6 space-y-4">
						<div className="space-y-2">
							<Label htmlFor="name">Channel Name</Label>
							<Input
								id="name"
								placeholder="e.g., architecture"
								autoFocus
								{...register("name")}
							/>
							{errors.name && (
								<p className="text-sm text-destructive">
									{errors.name.message}
								</p>
							)}
							<p className="text-xs text-muted-foreground">
								Lowercase letters, numbers, and hyphens only
							</p>
						</div>

						<div className="space-y-2">
							<Label htmlFor="description">
								Description{" "}
								<span className="text-muted-foreground">(optional)</span>
							</Label>
							<Textarea
								id="description"
								placeholder="What is this channel for?"
								rows={3}
								{...register("description")}
							/>
							{errors.description && (
								<p className="text-sm text-destructive">
									{errors.description.message}
								</p>
							)}
						</div>

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
						<Button type="submit" disabled={!isValid || isSubmitting}>
							{isSubmitting ? "Creating..." : "Create"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
