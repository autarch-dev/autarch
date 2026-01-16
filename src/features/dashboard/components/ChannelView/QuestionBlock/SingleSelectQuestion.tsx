import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import type { SingleQuestionProps } from "./types";

export function SingleSelectQuestion({
	question,
	value,
	onChange,
	disabled,
}: SingleQuestionProps) {
	const selectedValue = typeof value === "string" ? value : "";

	return (
		<RadioGroup
			value={selectedValue}
			onValueChange={onChange}
			disabled={disabled}
			className="space-y-2"
		>
			{question.options?.map((option) => (
				<div
					key={option}
					className={cn(
						"flex items-center gap-3 p-3 rounded-md border transition-colors",
						selectedValue === option
							? "border-primary bg-primary/5"
							: "border-border hover:bg-muted/50",
					)}
				>
					<RadioGroupItem value={option} id={`${question.id}-${option}`} />
					<Label
						htmlFor={`${question.id}-${option}`}
						className="flex-1 cursor-pointer font-normal"
					>
						{option}
					</Label>
				</div>
			))}
		</RadioGroup>
	);
}
