import { CheckCircle2 } from "lucide-react";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { WorkflowStatus } from "../../types";
import { statusConfig, workflowPhases } from "./config";

interface PhaseIndicatorProps {
	currentStatus: WorkflowStatus;
}

export function PhaseIndicator({ currentStatus }: PhaseIndicatorProps) {
	const currentIndex = workflowPhases.indexOf(currentStatus);

	return (
		<div className="flex items-center gap-1 overflow-x-auto pb-2">
			{workflowPhases.map((phase, idx) => {
				const config = statusConfig[phase];
				const Icon = config.icon;
				const isComplete = idx < currentIndex;
				const isCurrent = phase === currentStatus;
				const isPending = idx > currentIndex;

				return (
					<div key={phase} className="flex items-center">
						{idx > 0 && (
							<div
								className={cn(
									"w-6 h-0.5 mx-1",
									isComplete ? "bg-green-500" : "bg-border",
								)}
							/>
						)}
						<Tooltip>
							<TooltipTrigger asChild>
								<div
									className={cn(
										"flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-colors",
										isCurrent && config.bg,
										isCurrent && config.color,
										isComplete && "text-green-500",
										isPending && "text-muted-foreground",
									)}
								>
									{isComplete ? (
										<CheckCircle2 className="size-3.5" />
									) : (
										<Icon className="size-3.5" />
									)}
									<span className="hidden sm:inline">{config.label}</span>
								</div>
							</TooltipTrigger>
							<TooltipContent>{config.label}</TooltipContent>
						</Tooltip>
					</div>
				);
			})}
		</div>
	);
}
