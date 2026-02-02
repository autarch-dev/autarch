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
		<div className="flex items-center overflow-x-auto px-1 py-2">
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
					<div key={phase} className="flex items-center">
						<Tooltip>
							<TooltipTrigger asChild>
								<button
									type="button"
									disabled={!isEnabled}
									className={cn(
										"flex items-center gap-2 px-6 py-2 text-xs font-medium transition-colors border-y-2 border-transparent",
										isSkipped && "opacity-50 italic",
										isCurrent && config.bg,
										isCurrent && config.color,
										isCurrent && "font-bold",
										isComplete && "bg-green-700/20 text-green-500",
										isPending && "bg-muted-foreground/20 text-muted-foreground",
										isEnabled ? "cursor-pointer" : "cursor-not-allowed",
										isViewed && "border-b-current"
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
