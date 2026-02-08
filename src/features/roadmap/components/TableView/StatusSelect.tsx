import { Badge } from "@/components/ui/badge";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { InitiativeStatus } from "@/shared/schemas";

const STATUS_OPTIONS: { value: InitiativeStatus; label: string }[] = [
	{ value: "not_started", label: "Not Started" },
	{ value: "in_progress", label: "In Progress" },
	{ value: "completed", label: "Completed" },
	{ value: "blocked", label: "Blocked" },
];

const STATUS_COLORS: Record<InitiativeStatus, string> = {
	not_started: "text-muted-foreground bg-muted",
	in_progress: "text-blue-700 bg-blue-100 dark:text-blue-400 dark:bg-blue-950",
	completed:
		"text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-950",
	blocked: "text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-950",
};

export function StatusSelect({
	value,
	onSave,
}: {
	value: InitiativeStatus;
	onSave: (value: InitiativeStatus) => void;
}) {
	const option = STATUS_OPTIONS.find((o) => o.value === value);

	return (
		<Select value={value} onValueChange={(v) => onSave(v as InitiativeStatus)}>
			<SelectTrigger
				size="sm"
				className="h-7 text-xs border-none shadow-none px-0 gap-1 w-auto"
			>
				<SelectValue>
					<Badge
						variant="secondary"
						className={cn("text-xs", STATUS_COLORS[value])}
					>
						{option?.label ?? value}
					</Badge>
				</SelectValue>
			</SelectTrigger>
			<SelectContent>
				{STATUS_OPTIONS.map((opt) => (
					<SelectItem key={opt.value} value={opt.value}>
						<Badge
							variant="secondary"
							className={cn("text-xs", STATUS_COLORS[opt.value])}
						>
							{opt.label}
						</Badge>
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
