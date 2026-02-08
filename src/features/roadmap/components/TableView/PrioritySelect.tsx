import { Badge } from "@/components/ui/badge";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { InitiativePriority } from "@/shared/schemas";

const PRIORITY_OPTIONS: { value: InitiativePriority; label: string }[] = [
	{ value: "low", label: "Low" },
	{ value: "medium", label: "Medium" },
	{ value: "high", label: "High" },
	{ value: "critical", label: "Critical" },
];

const PRIORITY_COLORS: Record<InitiativePriority, string> = {
	low: "text-muted-foreground bg-muted",
	medium: "text-blue-700 bg-blue-100 dark:text-blue-400 dark:bg-blue-950",
	high: "text-orange-700 bg-orange-100 dark:text-orange-400 dark:bg-orange-950",
	critical: "text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-950",
};

export function PrioritySelect({
	value,
	onSave,
}: {
	value: InitiativePriority;
	onSave: (value: InitiativePriority) => void;
}) {
	const option = PRIORITY_OPTIONS.find((o) => o.value === value);

	return (
		<Select
			value={value}
			onValueChange={(v) => onSave(v as InitiativePriority)}
		>
			<SelectTrigger
				size="sm"
				className="h-7 text-xs border-none shadow-none bg-transparent dark:bg-transparent dark:hover:bg-transparent px-1 gap-1 w-auto"
			>
				<SelectValue>
					<Badge
						variant="secondary"
						className={cn("text-xs", PRIORITY_COLORS[value])}
					>
						{option?.label ?? value}
					</Badge>
				</SelectValue>
			</SelectTrigger>
			<SelectContent>
				{PRIORITY_OPTIONS.map((opt) => (
					<SelectItem key={opt.value} value={opt.value}>
						<Badge
							variant="secondary"
							className={cn("text-xs", PRIORITY_COLORS[opt.value])}
						>
							{opt.label}
						</Badge>
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
