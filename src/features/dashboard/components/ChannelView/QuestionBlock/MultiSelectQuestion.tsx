import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { SingleQuestionProps } from "./types";

export function MultiSelectQuestion({
	question,
	value,
	onChange,
	disabled,
}: SingleQuestionProps) {
	const selectedValues = Array.isArray(value) ? (value as string[]) : [];

	const toggleOption = (option: string, checked: boolean) => {
		if (checked) {
			onChange([...selectedValues, option]);
		} else {
			onChange(selectedValues.filter((v) => v !== option));
		}
	};

	return (
		<div className="space-y-2">
			{question.options?.map((option) => {
				const isChecked = selectedValues.includes(option);
				return (
					<div
						key={option}
						className={cn(
							"flex items-center gap-3 p-3 rounded-md border transition-colors",
							isChecked
								? "border-primary bg-primary/5"
								: "border-border hover:bg-muted/50",
						)}
					>
						<Checkbox
							id={`${question.id}-${option}`}
							checked={isChecked}
							onCheckedChange={(checked) =>
								toggleOption(option, checked === true)
							}
							disabled={disabled}
						/>
						<Label
							htmlFor={`${question.id}-${option}`}
							className="flex-1 cursor-pointer font-normal"
						>
							{option}
						</Label>
					</div>
				);
			})}
		</div>
	);
}
