/**
 * ProgressControls - Component for displaying initiative progress
 *
 * Shows a progress bar with percentage label and workflow status badge.
 * Progress is always auto-computed from linked workflow status.
 */

import { Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import type { Initiative } from "@/shared/schemas/roadmap";
import type { WorkflowStatus } from "@/shared/schemas/workflow";

// =============================================================================
// Workflow Status → Progress Mapping
// =============================================================================

export const WORKFLOW_STATUS_PROGRESS: Record<WorkflowStatus, number> = {
	backlog: 0,
	scoping: 10,
	researching: 25,
	planning: 40,
	in_progress: 60,
	review: 80,
	done: 100,
};

/**
 * Compute initiative progress from a linked workflow's status.
 */
export function computeProgressFromWorkflow(status: WorkflowStatus): number {
	return WORKFLOW_STATUS_PROGRESS[status] ?? 0;
}

// =============================================================================
// Props
// =============================================================================

interface ProgressControlsProps {
	initiative: Initiative;
	linkedWorkflowStatus?: WorkflowStatus;
	onUpdateProgress: (progress: number) => void;
}

// =============================================================================
// Component
// =============================================================================

export function ProgressControls({
	initiative,
	linkedWorkflowStatus,
}: ProgressControlsProps) {
	const displayProgress = linkedWorkflowStatus
		? computeProgressFromWorkflow(linkedWorkflowStatus)
		: initiative.progress;

	return (
		<div className="space-y-3">
			<Label>Progress</Label>

			{/* Progress bar with percentage */}
			<div className="space-y-1.5">
				<div className="flex items-center justify-between">
					<Progress value={displayProgress} className="h-2 flex-1 mr-3" />
					<span className="text-sm font-medium tabular-nums w-10 text-right">
						{displayProgress}%
					</span>
				</div>
			</div>

			{/* Auto mode info */}
			<div className="text-xs text-muted-foreground flex items-start gap-1.5">
				<Info className="size-3.5 mt-0.5 shrink-0" />
				{linkedWorkflowStatus ? (
					<span>
						Tracking from linked workflow{" "}
						<Badge variant="secondary" className="text-xs">
							{linkedWorkflowStatus.replace("_", " ")}
						</Badge>
					</span>
				) : (
					<span>Link a workflow to track progress automatically.</span>
				)}
			</div>
		</div>
	);
}
