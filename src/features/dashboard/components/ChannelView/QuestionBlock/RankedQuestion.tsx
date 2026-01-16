import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { SingleQuestionProps } from "./types";

export function RankedQuestion({
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
			<p className="text-xs text-muted-foreground">
				Select options in order of preference (first selected = highest
				priority)
			</p>
			{question.options?.map((option) => {
				const index = selectedValues.indexOf(option);
				const isSelected = index !== -1;

				return (
					<div
						key={option}
						className={cn(
							"flex items-center gap-3 p-3 rounded-md border transition-colors",
							isSelected
								? "border-primary bg-primary/5"
								: "border-border hover:bg-muted/50",
						)}
					>
						<div
							className={cn(
								"size-5 flex items-center justify-center rounded text-xs font-medium shrink-0",
								isSelected
									? "bg-primary text-primary-foreground"
									: "bg-muted text-muted-foreground",
							)}
						>
							{isSelected ? index + 1 : "-"}
						</div>
						<Checkbox
							id={`${question.id}-${option}`}
							checked={isSelected}
							onCheckedChange={(checked) =>
								toggleOption(option, checked === true)
							}
							disabled={disabled}
							className="sr-only"
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
