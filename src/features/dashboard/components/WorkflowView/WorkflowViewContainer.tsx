/**
 * WorkflowViewContainer - Container component for WorkflowView
 *
 * Owns data fetching and state management for a specific workflow,
 * driven by URL parameter.
 */

import { useCallback, useEffect } from "react";
import { useLocation } from "wouter";
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

	const {
		workflows,
		workflowsLoading,
		conversations,
		scopeCards,
		researchCards,
		plans,
		reviewCards,
		pulses,
		preflightSetups,
		selectWorkflow,
		fetchHistory,
		approveArtifact,
		approveWithMerge,
		requestChanges,
		requestFixes,
		rewindWorkflow,
	} = useWorkflowsStore();

	const workflow = workflows.find((w) => w.id === workflowId);
	const conversation = conversations.get(workflowId);

	// Select workflow and fetch history when workflowId changes
	useEffect(() => {
		selectWorkflow(workflowId);
		if (!conversation) {
			fetchHistory(workflowId);
		}
	}, [workflowId, conversation, selectWorkflow, fetchHistory]);

	// Get artifacts for this workflow
	const workflowScopeCards = scopeCards.get(workflowId) ?? [];
	const workflowResearchCards = researchCards.get(workflowId) ?? [];
	const workflowPlans = plans.get(workflowId) ?? [];
	const workflowReviewCards = reviewCards.get(workflowId) ?? [];
	const workflowPulses = pulses.get(workflowId) ?? [];
	const workflowPreflightSetup = preflightSetups.get(workflowId);

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
			totalCost={conversation?.totalCost ?? null}
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
