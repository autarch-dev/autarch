/**
 * Shared types for stage view components
 *
 * Defines the consistent prop contract for all stage-specific view components
 * (ScopingStageView, ResearchingStageView, PlanningStageView, ExecutionStageView, ReviewStageView).
 */

import type { ChannelMessage } from "@/shared/schemas/channel";
import type {
	MergeStrategy,
	RewindTarget,
	Workflow,
} from "@/shared/schemas/workflow";
import type { StreamingMessage } from "../../store/workflowsStore";

/**
 * Shared props for all stage view components.
 *
 * Required fields provide the core data needed to render any stage view.
 * Optional callbacks allow stage views to trigger workflow actions when appropriate.
 */
export interface StageViewProps {
	/** The workflow being displayed */
	workflow: Workflow;

	/** Messages to display in the stage view */
	messages: ChannelMessage[];

	/** Whether the view is loading initial data */
	isLoading: boolean;

	/** Currently streaming message, if any */
	streamingMessage: StreamingMessage | null;

	/** Approve the current artifact (research card, plan) */
	onApprove?: () => Promise<void>;

	/** Approve scope card with selected path */
	onApproveScope?: (path: "quick" | "full") => Promise<void>;

	/** Approve review card with merge options */
	onApproveWithMerge?: (mergeOptions: {
		mergeStrategy: MergeStrategy;
		commitMessage: string;
	}) => Promise<void>;

	/** Request changes with feedback */
	onRequestChanges?: (feedback: string) => Promise<void>;

	/** Request fixes for specific review comments */
	onRequestFixes?: (commentIds: string[], summary?: string) => Promise<void>;

	/** Rewind workflow to a previous stage */
	onRewind?: (targetStage: RewindTarget) => Promise<void>;
}
