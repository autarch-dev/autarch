import { CheckCircle2, SkipForward } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
	const activeStage = viewedStage ?? currentStatus;

	return (
		<Tabs
			value={activeStage}
			onValueChange={(value) => onStageClick?.(value as WorkflowStatus)}
			className="w-full"
		>
			<div className="w-full pb-1">
				<TabsList className="h-auto w-full gap-1 rounded-none bg-transparent p-0">
					{workflowPhases.map((phase, idx) => {
						const config = statusConfig[phase];
						const Icon = config.icon;
						const isSkipped =
							skippedStages?.includes(phase.toLowerCase()) ?? false;
						const isComplete = idx < currentIndex && !isSkipped;
						const isCurrent = phase === currentStatus;
						const isEnabled = idx <= currentIndex && !isSkipped;
						const isSelected = phase === activeStage;

						return (
							<div key={phase}>
								<Tooltip>
									<TooltipTrigger asChild>
										<TabsTrigger
											value={phase}
											disabled={!isEnabled}
											className={cn(
												"h-8 flex-1 justify-center gap-2 rounded-md border px-3 text-xs",
												"border-transparent bg-transparent shadow-none",
												"data-[state=active]:border-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none",
												isSkipped && "italic",
												isComplete && "text-green-600 dark:text-green-400",
												isCurrent && cn(config.color, "font-semibold"),
												isSelected &&
													"border-border bg-background text-foreground shadow-sm data-[state=active]:border-border data-[state=active]:bg-background",
												isCurrent &&
													isSelected &&
													"border-current/25 bg-current/10 data-[state=active]:bg-current/10",
											)}
										>
											{isSkipped ? (
												<SkipForward className="size-3.5" />
											) : isComplete ? (
												<CheckCircle2 className="size-3.5" />
											) : (
												<Icon className="size-3.5" />
											)}
											<span>{config.label}</span>
										</TabsTrigger>
									</TooltipTrigger>
									<TooltipContent>
										{isSkipped ? `${config.label} (Skipped)` : config.label}
									</TooltipContent>
								</Tooltip>
							</div>
						);
					})}
				</TabsList>
			</div>
		</Tabs>
	);
}
