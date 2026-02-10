/**
 * CompletedWorkflowsPage - Container component for the completed workflows page
 *
 * Fetches and enriches completed workflow data (cost, review summary, diff stats,
 * roadmap initiative linking) and passes it to the CompletedWorkflowsList presenter.
 */

import { useEffect, useMemo, useState } from "react";
import { useRoadmapStore } from "@/features/roadmap/store/roadmapStore";
import type { Initiative } from "@/shared/schemas/roadmap";
import type { Workflow } from "@/shared/schemas/workflow";
import { useWorkflowsStore } from "../../store";
import { type DiffStats, parseDiffStats } from "../../utils/parseDiffStats";
import { CompletedWorkflowsList } from "./CompletedWorkflowsList";

/** Enriched workflow with computed metadata for display */
export interface EnrichedWorkflow {
	workflow: Workflow;
	totalCost: number | null;
	reviewSummary: string | null;
	diffStats: DiffStats | null;
	duration: number;
	initiativeTitle: string | null;
}

/** Batch size for sequential fetchHistory calls */
const FETCH_BATCH_SIZE = 5;

export function CompletedWorkflowsPage() {
	const [isLoading, setIsLoading] = useState(true);

	const { workflows, conversations, reviewCards, subtasks, fetchHistory } =
		useWorkflowsStore();

	const { roadmaps, roadmapDetails, fetchRoadmapDetails } = useRoadmapStore();

	// Filter and sort completed workflows (status === 'done', sorted by updatedAt desc)
	const completedWorkflows = useMemo(
		() =>
			workflows
				.filter((w) => w.status === "done")
				.sort((a, b) => b.updatedAt - a.updatedAt),
		[workflows],
	);

	// Fetch history for completed workflows that don't have data loaded yet
	useEffect(() => {
		const workflowsToFetch = completedWorkflows.filter(
			(w) => !conversations.has(w.id),
		);

		if (workflowsToFetch.length === 0) {
			setIsLoading(false);
			return;
		}

		let cancelled = false;

		async function fetchInBatches() {
			for (let i = 0; i < workflowsToFetch.length; i += FETCH_BATCH_SIZE) {
				if (cancelled) return;

				const batch = workflowsToFetch.slice(i, i + FETCH_BATCH_SIZE);
				await Promise.all(batch.map((w) => fetchHistory(w.id)));

				// Mark loading complete after the first batch finishes
				if (i === 0) {
					setIsLoading(false);
				}
			}
		}

		fetchInBatches();

		return () => {
			cancelled = true;
		};
	}, [completedWorkflows, conversations, fetchHistory]);

	// Fetch roadmap details for all roadmaps that don't have details loaded
	useEffect(() => {
		const roadmapsToFetch = roadmaps.filter((r) => !roadmapDetails.has(r.id));

		for (const roadmap of roadmapsToFetch) {
			fetchRoadmapDetails(roadmap.id).catch(() => {
				// Ignore fetch errors - non-critical for completed workflows page
			});
		}
	}, [roadmaps, roadmapDetails, fetchRoadmapDetails]);

	// Build a Map<workflowId, Initiative> for initiative linking
	const initiativeByWorkflowId = useMemo(() => {
		const map = new Map<string, Initiative>();
		for (const details of roadmapDetails.values()) {
			for (const initiative of details.initiatives) {
				if (initiative.workflowId) {
					map.set(initiative.workflowId, initiative);
				}
			}
		}
		return map;
	}, [roadmapDetails]);

	// Compute enriched data for each completed workflow
	const enrichedWorkflows = useMemo((): EnrichedWorkflow[] => {
		return completedWorkflows.map((workflow) => {
			// Total cost = sum of message costs + subtask costs
			const messages = conversations.get(workflow.id)?.messages ?? [];
			const workflowSubtasks = subtasks.get(workflow.id) ?? [];

			const messageCost = messages.reduce(
				(sum, msg) => sum + (msg.cost ?? 0),
				0,
			);
			const subtaskCost = workflowSubtasks.reduce(
				(sum, st) => sum + (st.cost ?? 0),
				0,
			);
			const totalCost = messageCost + subtaskCost || null;

			// Review summary = first review card's summary
			const workflowReviewCards = reviewCards.get(workflow.id) ?? [];
			const firstReviewCard = workflowReviewCards[0];
			const reviewSummary = firstReviewCard?.summary ?? null;

			// Diff stats from first review card's diffContent
			const diffStats = firstReviewCard?.diffContent
				? parseDiffStats(firstReviewCard.diffContent)
				: null;

			// Duration = updatedAt - createdAt
			const duration = workflow.updatedAt - workflow.createdAt;

			// Initiative title from roadmap linking
			const initiative = initiativeByWorkflowId.get(workflow.id);
			const initiativeTitle = initiative?.title ?? null;

			return {
				workflow,
				totalCost,
				reviewSummary,
				diffStats,
				duration,
				initiativeTitle,
			};
		});
	}, [
		completedWorkflows,
		conversations,
		subtasks,
		reviewCards,
		initiativeByWorkflowId,
	]);

	return (
		<CompletedWorkflowsList
			enrichedWorkflows={enrichedWorkflows}
			isLoading={isLoading}
		/>
	);
}
