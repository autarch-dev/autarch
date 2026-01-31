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
	viewedStage?: WorkflowStatus;
	onStageClick?: (stage: WorkflowStatus) => void;
}

export function PhaseIndicator({
	currentStatus,
	skippedStages,
	viewedStage,
	onStageClick,
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
				const isEnabled = idx <= currentIndex && !isSkipped;
				const isViewed = phase === viewedStage;

				return (
					<div key={phase} className="flex items-center m-1">
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
								<button
									type="button"
									disabled={!isEnabled}
									className={cn(
										"flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-colors",
										isSkipped && "opacity-50 italic",
										isCurrent && config.bg,
										isCurrent && config.color,
										isComplete && "text-green-500",
										isPending && "text-muted-foreground",
										isEnabled ? "cursor-pointer" : "cursor-not-allowed",
										isViewed && "ring-1 ring-current",
									)}
									onClick={() => onStageClick?.(phase)}
								>
									{isSkipped ? (
										<SkipForward className="size-3.5" />
									) : isComplete ? (
										<CheckCircle2 className="size-3.5" />
									) : (
										<Icon className="size-3.5" />
									)}
									<span className="hidden sm:inline">{config.label}</span>
								</button>
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
