/**
 * ProgressControls - Component for managing initiative progress
 *
 * Shows a progress bar with percentage label, a toggle between
 * 'Auto' and 'Manual' progress modes, and mode-specific controls.
 * Manual mode: range slider to set progress 0-100.
 * Auto mode: read-only computed progress from linked workflow.
 */

import { Info } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import type { Initiative, ProgressMode } from "@/shared/schemas/roadmap";
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
	onUpdateProgressMode: (mode: ProgressMode) => void;
}

// =============================================================================
// Component
// =============================================================================

export function ProgressControls({
	initiative,
	linkedWorkflowStatus,
	onUpdateProgress,
	onUpdateProgressMode,
}: ProgressControlsProps) {
	const [localProgress, setLocalProgress] = useState(initiative.progress);

	// Sync local slider state when initiative changes (e.g., prop update, switching initiatives).
	// initiative.id is intentionally included to reset when switching between initiatives,
	// even if two initiatives share the same progress value.
	// biome-ignore lint/correctness/useExhaustiveDependencies: initiative.id triggers reset on initiative switch
	useEffect(() => {
		setLocalProgress(initiative.progress);
	}, [initiative.id, initiative.progress]);

	const isAuto = initiative.progressMode === "auto";

	const displayProgress =
		isAuto && linkedWorkflowStatus
			? computeProgressFromWorkflow(linkedWorkflowStatus)
			: initiative.progress;

	const handleModeToggle = useCallback(
		(mode: ProgressMode) => {
			onUpdateProgressMode(mode);
		},
		[onUpdateProgressMode],
	);

	const handleProgressChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const value = Number(e.target.value);
			setLocalProgress(value);
		},
		[],
	);

	const handleProgressCommit = useCallback(() => {
		if (localProgress !== initiative.progress) {
			onUpdateProgress(localProgress);
		}
	}, [localProgress, initiative.progress, onUpdateProgress]);

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

			{/* Mode toggle */}
			<div className="flex items-center gap-2">
				<span className="text-xs text-muted-foreground">Mode:</span>
				<div className="flex rounded-md border">
					<button
						type="button"
						className={`px-2.5 py-1 text-xs rounded-l-md transition-colors ${
							isAuto ? "bg-primary text-primary-foreground" : "hover:bg-muted"
						}`}
						onClick={() => handleModeToggle("auto")}
					>
						Auto
					</button>
					<button
						type="button"
						className={`px-2.5 py-1 text-xs rounded-r-md transition-colors ${
							!isAuto ? "bg-primary text-primary-foreground" : "hover:bg-muted"
						}`}
						onClick={() => handleModeToggle("manual")}
					>
						Manual
					</button>
				</div>
			</div>

			{/* Mode-specific controls */}
			{isAuto ? (
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
						<span>
							No workflow linked — switch to manual or link a workflow.
						</span>
					)}
				</div>
			) : (
				<div className="space-y-1">
					<input
						type="range"
						min={0}
						max={100}
						step={5}
						value={localProgress}
						onChange={handleProgressChange}
						onMouseUp={handleProgressCommit}
						onKeyUp={handleProgressCommit}
						className="w-full h-2 bg-muted rounded-full appearance-none cursor-pointer accent-primary"
					/>
					<div className="flex justify-between text-xs text-muted-foreground">
						<span>0%</span>
						<span>50%</span>
						<span>100%</span>
					</div>
				</div>
			)}
		</div>
	);
}
