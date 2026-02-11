/**
 * WorkflowViewContainer - Container component for WorkflowView
 *
 * Owns data fetching and state management for a specific workflow,
 * driven by URL parameter.
 */

import { useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { useShallow } from "zustand/react/shallow";
import type { MergeStrategy, RewindTarget } from "@/shared/schemas/workflow";
import { useWorkflowsStore } from "../../store";
import { WorkflowView } from "./WorkflowView";

interface WorkflowViewContainerProps {
	workflowId: string;
}

export function WorkflowViewContainer({
	workflowId,
}: WorkflowViewContainerProps) {
	const [, setLocation] = useLocation();

	// Select only the data for this specific workflow (shallow-compared)
	const {
		workflow,
		workflowsLoading,
		conversation,
		workflowScopeCards,
		workflowResearchCards,
		workflowPlans,
		workflowReviewCards,
		workflowPulses,
		workflowPreflightSetup,
	} = useWorkflowsStore(
		useShallow((s) => ({
			workflow: s.workflows.find((w) => w.id === workflowId),
			workflowsLoading: s.workflowsLoading,
			conversation: s.conversations.get(workflowId),
			workflowScopeCards: s.scopeCards.get(workflowId) ?? [],
			workflowResearchCards: s.researchCards.get(workflowId) ?? [],
			workflowPlans: s.plans.get(workflowId) ?? [],
			workflowReviewCards: s.reviewCards.get(workflowId) ?? [],
			workflowPulses: s.pulses.get(workflowId) ?? [],
			workflowPreflightSetup: s.preflightSetups.get(workflowId),
		})),
	);

	// Actions are stable references — select individually without shallow comparison
	const selectWorkflow = useWorkflowsStore((s) => s.selectWorkflow);
	const fetchHistory = useWorkflowsStore((s) => s.fetchHistory);
	const approveArtifact = useWorkflowsStore((s) => s.approveArtifact);
	const approveWithMerge = useWorkflowsStore((s) => s.approveWithMerge);
	const requestChanges = useWorkflowsStore((s) => s.requestChanges);
	const requestFixes = useWorkflowsStore((s) => s.requestFixes);
	const rewindWorkflow = useWorkflowsStore((s) => s.rewindWorkflow);

	// Select workflow and fetch history when workflowId changes
	useEffect(() => {
		selectWorkflow(workflowId);
		if (!conversation) {
			fetchHistory(workflowId);
		}
	}, [workflowId, conversation, selectWorkflow, fetchHistory]);

	const handleApproveScope = useCallback(
		async (path: "quick" | "full") => {
			await approveArtifact(workflowId, path);
		},
		[workflowId, approveArtifact],
	);

	const handleApprove = useCallback(async () => {
		await approveArtifact(workflowId);
	}, [workflowId, approveArtifact]);

	const handleRequestChanges = useCallback(
		async (feedback: string) => {
			await requestChanges(workflowId, feedback);
		},
		[workflowId, requestChanges],
	);

	const handleApproveWithMerge = useCallback(
		async (mergeOptions: {
			mergeStrategy: MergeStrategy;
			commitMessage: string;
		}) => {
			await approveWithMerge(workflowId, mergeOptions);
		},
		[workflowId, approveWithMerge],
	);

	const handleRewindWorkflow = useCallback(
		async (targetStage: RewindTarget) => {
			await rewindWorkflow(workflowId, targetStage);
		},
		[workflowId, rewindWorkflow],
	);

	const handleRequestFixes = useCallback(
		async (commentIds: string[], summary?: string) => {
			await requestFixes(workflowId, commentIds, summary);
		},
		[workflowId, requestFixes],
	);

	const handleWorkflowArchived = useCallback(() => {
		// Navigate back to dashboard root when workflow is archived
		setLocation("/dashboard");
	}, [setLocation]);

	// Workflow not found - show not found state
	if (!workflow) {
		return (
			<div className="flex items-center justify-center h-full">
				<p className="text-muted-foreground">Workflow not found</p>
			</div>
		);
	}

	return (
		<WorkflowView
			workflow={workflow}
			messages={conversation?.messages ?? []}
			streamingMessage={conversation?.streamingMessage}
			isLoading={conversation?.isLoading ?? workflowsLoading}
			scopeCards={workflowScopeCards}
			researchCards={workflowResearchCards}
			plans={workflowPlans}
			reviewCards={workflowReviewCards}
			pulses={workflowPulses}
			preflightSetup={workflowPreflightSetup}
			onApproveScope={handleApproveScope}
			onApprove={handleApprove}
			onApproveWithMerge={handleApproveWithMerge}
			onRequestChanges={handleRequestChanges}
			onRequestFixes={handleRequestFixes}
			onRewind={handleRewindWorkflow}
			onArchived={handleWorkflowArchived}
		/>
	);
}
