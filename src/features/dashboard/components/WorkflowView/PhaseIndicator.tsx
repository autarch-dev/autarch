import { CheckCircle2, SkipForward } from "lucide-react";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { WorkflowStatus } from "@/shared/schemas/workflow";
import { statusConfig, workflowPhases } from "./config";

interface PhaseIndicatorProps {
	currentStatus: WorkflowStatus;
	skippedStages?: string[];
}

export function PhaseIndicator({
	currentStatus,
	skippedStages,
}: PhaseIndicatorProps) {
	const currentIndex = workflowPhases.indexOf(currentStatus);

	return (
		<div className="flex items-center gap-1 overflow-x-auto pb-2">
			{workflowPhases.map((phase, idx) => {
				const config = statusConfig[phase];
				const Icon = config.icon;
				const isSkipped = skippedStages?.includes(phase.toLowerCase()) ?? false;
				const isComplete = idx < currentIndex && !isSkipped;
				const isCurrent = phase === currentStatus;
				const isPending = idx > currentIndex && !isSkipped;

				return (
					<div key={phase} className="flex items-center">
						{idx > 0 && (
							<div
								className={cn(
									"w-6 h-0.5 mx-1",
									isSkipped
										? "bg-border/50"
										: isComplete
											? "bg-green-500"
											: "bg-border",
								)}
							/>
						)}
						<Tooltip>
							<TooltipTrigger asChild>
								<div
									className={cn(
										"flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-colors",
										isSkipped && "opacity-50 italic",
										isCurrent && config.bg,
										isCurrent && config.color,
										isComplete && "text-green-500",
										isPending && "text-muted-foreground",
									)}
								>
									{isSkipped ? (
										<SkipForward className="size-3.5" />
									) : isComplete ? (
										<CheckCircle2 className="size-3.5" />
									) : (
										<Icon className="size-3.5" />
									)}
									<span className="hidden sm:inline">{config.label}</span>
								</div>
							</TooltipTrigger>
							<TooltipContent>
								{isSkipped ? `${config.label} (Skipped)` : config.label}
							</TooltipContent>
						</Tooltip>
					</div>
				);
			})}
		</div>
	);
}
