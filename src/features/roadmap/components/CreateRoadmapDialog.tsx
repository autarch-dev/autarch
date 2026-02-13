import {
	Compass,
	Cpu,
	Layers,
	Lightbulb,
	ListChecks,
	type LucideIcon,
} from "lucide-react";
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
import type { RoadmapPerspective } from "@/features/roadmap/store/roadmapStore";
import { cn } from "@/lib/utils";

interface PerspectiveOption {
	id: RoadmapPerspective;
	label: string;
	description: string;
	icon: LucideIcon;
}

const BALANCED_OPTION: PerspectiveOption = {
	id: "balanced",
	label: "Balanced View",
	description:
		"Get a comprehensive roadmap that synthesizes multiple planning perspectives into a unified plan.",
	icon: Layers,
};

const INDIVIDUAL_OPTIONS: PerspectiveOption[] = [
	{
		id: "visionary",
		label: "The Visionary",
		description:
			"Bold, big-picture thinking focused on long-term impact and transformative goals.",
		icon: Lightbulb,
	},
	{
		id: "iterative",
		label: "Step by Step",
		description:
			"Practical, incremental approach focused on delivering value through small, steady wins.",
		icon: ListChecks,
	},
	{
		id: "tech_lead",
		label: "Technical Blueprint",
		description:
			"Architecture-first planning driven by technical feasibility and engineering excellence.",
		icon: Cpu,
	},
	{
		id: "pathfinder",
		label: "Strategic Pathfinder",
		description:
			"Navigate uncertainty with adaptive strategies that balance risk and opportunity.",
		icon: Compass,
	},
];

interface CreateRoadmapFormData {
	title: string;
	prompt: string;
}

interface CreateRoadmapDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onCreate: (
		title: string,
		perspective: RoadmapPerspective,
		prompt?: string,
	) => Promise<void>;
}

export function CreateRoadmapDialog({
	open,
	onOpenChange,
	onCreate,
}: CreateRoadmapDialogProps) {
	const [selectedPerspective, setSelectedPerspective] =
		useState<RoadmapPerspective>("balanced");
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
			setSelectedPerspective("balanced");
			setError(null);
		}
	}, [open, reset]);

	const handleCreate = async (data: CreateRoadmapFormData) => {
		if (!selectedPerspective) return;

		setIsSubmitting(true);
		setError(null);

		try {
			await onCreate(
				data.title.trim(),
				selectedPerspective,
				data.prompt.trim() || undefined,
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
							Choose a planning perspective to shape how your roadmap is
							generated.
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

						<div className="space-y-3">
							<PerspectiveCard
								option={BALANCED_OPTION}
								selected={selectedPerspective === BALANCED_OPTION.id}
								disabled={!hasTitle || isSubmitting}
								onClick={() => setSelectedPerspective(BALANCED_OPTION.id)}
							/>

							<div className="grid grid-cols-2 gap-3">
								{INDIVIDUAL_OPTIONS.map((option) => (
									<PerspectiveCard
										key={option.id}
										option={option}
										selected={selectedPerspective === option.id}
										disabled={!hasTitle || isSubmitting}
										onClick={() => setSelectedPerspective(option.id)}
									/>
								))}
							</div>
						</div>

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
							disabled={!hasTitle || !selectedPerspective || isSubmitting}
						>
							{isSubmitting ? "Creating..." : "Create Roadmap"}
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}

function PerspectiveCard({
	option,
	selected,
	disabled,
	onClick,
}: {
	option: PerspectiveOption;
	selected: boolean;
	disabled: boolean;
	onClick: () => void;
}) {
	const Icon = option.icon;

	return (
		<button
			type="button"
			disabled={disabled}
			onClick={onClick}
			className={cn(
				"flex flex-col items-start gap-3 rounded-lg border p-4 text-left transition-colors",
				"hover:bg-accent/50 disabled:pointer-events-none disabled:opacity-50",
				selected && "ring-2 ring-primary bg-accent/50",
			)}
		>
			<div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
				<Icon className="h-4 w-4 text-primary" />
			</div>
			<div>
				<div className="font-medium text-sm">{option.label}</div>
				<div className="mt-1 text-sm text-muted-foreground">
					{option.description}
				</div>
			</div>
		</button>
	);
}
