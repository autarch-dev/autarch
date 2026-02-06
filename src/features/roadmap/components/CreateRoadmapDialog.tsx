import { FileText, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface CreateRoadmapFormData {
	title: string;
	prompt: string;
}

interface CreateRoadmapDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onCreate: (
		title: string,
		mode: "ai" | "blank",
		prompt?: string,
	) => Promise<void>;
}

export function CreateRoadmapDialog({
	open,
	onOpenChange,
	onCreate,
}: CreateRoadmapDialogProps) {
	const [selectedMode, setSelectedMode] = useState<"ai" | "blank" | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const { register, handleSubmit, reset, watch } =
		useForm<CreateRoadmapFormData>({
			defaultValues: { title: "", prompt: "" },
			mode: "onChange",
		});

	const title = watch("title");
	const hasTitle = title.trim().length > 0;

	useEffect(() => {
		if (!open) {
			reset();
			setSelectedMode(null);
			setError(null);
		}
	}, [open, reset]);

	const handleCreate = async (data: CreateRoadmapFormData) => {
		if (!selectedMode) return;

		setIsSubmitting(true);
		setError(null);

		try {
			await onCreate(
				data.title.trim(),
				selectedMode,
				selectedMode === "ai" ? data.prompt.trim() || undefined : undefined,
			);
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
			<DialogContent className="sm:max-w-lg">
				<form onSubmit={handleSubmit(handleCreate)}>
					<DialogHeader>
						<DialogTitle>Create Roadmap</DialogTitle>
						<DialogDescription>
							Create a new product roadmap. Start with AI-assisted planning or a
							blank canvas.
						</DialogDescription>
					</DialogHeader>

					<div className="my-6 space-y-4">
						<div className="space-y-2">
							<Label htmlFor="roadmap-title">Title</Label>
							<Input
								id="roadmap-title"
								placeholder="e.g., Q1 Product Roadmap"
								autoFocus
								{...register("title", { required: true })}
							/>
						</div>

						<div className="grid grid-cols-2 gap-3">
							<button
								type="button"
								disabled={!hasTitle || isSubmitting}
								onClick={() => setSelectedMode("ai")}
								className={cn(
									"flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors",
									"hover:bg-accent/50 disabled:pointer-events-none disabled:opacity-50",
									selectedMode === "ai" &&
										"border-primary bg-accent ring-1 ring-primary",
								)}
							>
								<Sparkles className="size-5 text-primary" />
								<div className="font-medium text-sm">Start with AI</div>
								<div className="text-muted-foreground text-xs leading-relaxed">
									Describe your product goals and let AI help you build a
									roadmap
								</div>
							</button>

							<button
								type="button"
								disabled={!hasTitle || isSubmitting}
								onClick={() => setSelectedMode("blank")}
								className={cn(
									"flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors",
									"hover:bg-accent/50 disabled:pointer-events-none disabled:opacity-50",
									selectedMode === "blank" &&
										"border-primary bg-accent ring-1 ring-primary",
								)}
							>
								<FileText className="size-5 text-primary" />
								<div className="font-medium text-sm">Blank Canvas</div>
								<div className="text-muted-foreground text-xs leading-relaxed">
									Start with an empty roadmap and add milestones and initiatives
									manually
								</div>
							</button>
						</div>

						{selectedMode === "ai" && (
							<div className="space-y-2">
								<Label htmlFor="roadmap-prompt">
									Describe your product or goals
								</Label>
								<Textarea
									id="roadmap-prompt"
									placeholder="e.g., We're building a SaaS platform for project management targeting small teams..."
									className="max-h-[200px] overflow-y-auto"
									rows={4}
									{...register("prompt")}
								/>
							</div>
						)}

						{error && <p className="text-sm text-destructive">{error}</p>}
					</div>

					<div className="flex justify-end gap-2">
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
							disabled={isSubmitting}
						>
							Cancel
						</Button>
						<Button
							type="submit"
							disabled={!hasTitle || !selectedMode || isSubmitting}
						>
							{isSubmitting
								? "Creating..."
								: selectedMode === "ai"
									? "Create with AI"
									: "Create Roadmap"}
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
