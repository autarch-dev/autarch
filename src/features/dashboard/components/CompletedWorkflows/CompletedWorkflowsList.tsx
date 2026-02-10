/**
 * CompletedWorkflowsList - Presenter component for the completed workflows page
 *
 * Renders enriched completed workflows grouped by date buckets.
 * Placeholder until full implementation is added.
 */

import type { EnrichedWorkflow } from "./CompletedWorkflowsPage";

export interface CompletedWorkflowsListProps {
	enrichedWorkflows: EnrichedWorkflow[];
	isLoading: boolean;
}

export function CompletedWorkflowsList({
	enrichedWorkflows,
	isLoading,
}: CompletedWorkflowsListProps) {
	if (isLoading) {
		return (
			<div className="flex items-center justify-center h-full">
				<p className="text-muted-foreground">Loading completed workflows…</p>
			</div>
		);
	}

	if (enrichedWorkflows.length === 0) {
		return (
			<div className="flex items-center justify-center h-full">
				<p className="text-muted-foreground">No completed workflows yet</p>
			</div>
		);
	}

	return (
		<div className="p-6">
			<h1 className="text-2xl font-semibold mb-6">Completed Workflows</h1>
			<p className="text-muted-foreground">
				{enrichedWorkflows.length} completed workflow
				{enrichedWorkflows.length !== 1 ? "s" : ""}
			</p>
		</div>
	);
}
