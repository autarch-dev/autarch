/**
 * WorkflowView - Stage router for workflow views
 *
 * Routes to the appropriate stage-specific view component based on workflow status.
 * Maintains workflow header, stage navigation, and callback props for artifact approvals.
 * All message filtering and artifact interleaving is delegated to stage view components.
 */

import { memo, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { ChannelMessage } from "@/shared/schemas/channel";
import type {
	MergeStrategy,
	Plan,
	PreflightSetup,
	Pulse,
	ResearchCard,
	ReviewCard,
	RewindTarget,
	ScopeCard,
	Workflow,
	WorkflowStatus,
} from "@/shared/schemas/workflow";
import type { StreamingMessage } from "../../store/workflowsStore";
import { statusConfig } from "./config";
import { ExecutionStageView } from "./ExecutionStageView";
import { PlanningStageView } from "./PlanningStageView";
import { ResearchingStageView } from "./ResearchingStageView";
import { ReviewStageView } from "./ReviewStageView";
import { ScopingStageView } from "./ScopingStageView";
import type { StageViewProps } from "./types";
import { WorkflowEmptyState } from "./WorkflowEmptyState";
import { WorkflowHeader } from "./WorkflowHeader";

interface WorkflowViewProps {
	workflow: Workflow;
	messages: ChannelMessage[];
	streamingMessage?: StreamingMessage;
	isLoading?: boolean;
	totalCost: number | null;
	scopeCards: ScopeCard[];
	researchCards: ResearchCard[];
	plans: Plan[];
	reviewCards: ReviewCard[];
	pulses?: Pulse[];
	preflightSetup?: PreflightSetup;
	onApproveScope?: (path: "quick" | "full") => Promise<void>;
	onApprove?: () => Promise<void>;
	onApproveWithMerge?: (mergeOptions: {
		mergeStrategy: MergeStrategy;
		commitMessage: string;
	}) => Promise<void>;
	onRequestChanges?: (feedback: string) => Promise<void>;
	onRequestFixes?: (commentIds: string[], summary?: string) => Promise<void>;
	onRewind?: (targetStage: RewindTarget) => Promise<void>;
	onArchived?: () => void;
}

export const WorkflowView = memo(function WorkflowView({
	workflow,
	messages,
	streamingMessage,
	isLoading,
	totalCost,
	scopeCards,
	researchCards,
	plans,
	reviewCards,
	pulses = [],
	preflightSetup,
	onApproveScope,
	onApprove,
	onApproveWithMerge,
	onRequestChanges,
	onRequestFixes,
	onRewind,
	onArchived,
}: WorkflowViewProps) {
	// Track which stage the user is currently viewing (may differ from workflow.status)
	const [viewedStage, setViewedStage] = useState<WorkflowStatus>(
		workflow.status,
	);

	// Reset viewedStage when workflow changes (both id and status trigger reset)
	// biome-ignore lint/correctness/useExhaustiveDependencies: Intentionally reset on workflow.id change even though status is the value
	useEffect(() => {
		setViewedStage(workflow.status);
	}, [workflow.id, workflow.status]);

	const hasAnyContent = messages.length > 0 || streamingMessage;

	// Callback for when user clicks a stage in PhaseIndicator
	const handleStageClick = (stage: WorkflowStatus) => {
		setViewedStage(stage);
	};

	// Build shared stage view props
	const stageViewProps: StageViewProps = {
		workflow,
		messages,
		isLoading: isLoading ?? false,
		streamingMessage: streamingMessage ?? null,
		onApprove,
		onApproveScope,
		onApproveWithMerge,
		onRequestChanges,
		onRequestFixes,
		onRewind,
	};

	// Render the appropriate stage view based on viewedStage
	const renderStageView = () => {
		switch (viewedStage) {
			case "scoping":
				return <ScopingStageView {...stageViewProps} scopeCards={scopeCards} />;

			case "researching":
				return (
					<ResearchingStageView
						{...stageViewProps}
						researchCards={researchCards}
						scopeCards={scopeCards}
					/>
				);

			case "planning":
				return (
					<PlanningStageView
						{...stageViewProps}
						plans={plans}
						researchCards={researchCards}
					/>
				);

			case "in_progress":
				return (
					<ExecutionStageView
						{...stageViewProps}
						pulses={pulses}
						preflightSetup={preflightSetup}
						plans={plans}
					/>
				);

			case "review":
			case "done":
				// Review and done stages both render ReviewStageView
				// (workflow ends in review stage, done is the final state after merge)
				return (
					<ReviewStageView
						{...stageViewProps}
						reviewCards={reviewCards}
						plans={plans}
					/>
				);

			default:
				return null;
		}
	};

	return (
		<TooltipProvider>
			<div className="flex flex-col h-full">
				<WorkflowHeader
					workflow={workflow}
					totalCost={totalCost}
					onArchived={onArchived}
					viewedStage={viewedStage}
					onStageClick={handleStageClick}
				/>

				{workflow.status !== viewedStage && (
					<div className="mx-4 mt-2 px-4 py-2 rounded-lg border bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800 flex items-center justify-between">
						<span className="text-sm">
							Workflow moved to {statusConfig[workflow.status].label}
						</span>
						<Button
							variant="outline"
							size="sm"
							onClick={() => setViewedStage(workflow.status)}
						>
							View Current Stage
						</Button>
					</div>
				)}

				<ScrollArea className="flex-1 min-h-0">
					<div className="py-2">
						{isLoading && !hasAnyContent ? (
							<div className="flex items-center justify-center py-8">
								<span className="text-muted-foreground text-sm">
									Loading conversation...
								</span>
							</div>
						) : !hasAnyContent ? (
							<WorkflowEmptyState />
						) : (
							renderStageView()
						)}
					</div>
				</ScrollArea>
			</div>
		</TooltipProvider>
	);
});
