/**
 * Jira Sync Queue — Background message pump for Jira integration.
 *
 * Replaces fire-and-forget sync calls with a sequential, single-threaded queue.
 * Benefits:
 * - Eliminates race conditions (e.g., status sync before issue creation)
 * - Centralizes error handling and logging
 *
 * Usage:
 *   import { jiraSyncQueue } from "@/backend/services/jiraSyncQueue";
 *   jiraSyncQueue.enqueue({ type: "sync-workflow", workflowId: "..." });
 */

import type { WorkflowStatus } from "@/shared/schemas/workflow";
import { log } from "../logger";
import { getRepositories } from "../repositories";
import {
	syncArtifactComment,
	syncInitiative,
	syncMilestone,
	syncPulseStatus,
	syncPulses,
	syncWorkflow,
	syncWorkflowStatus,
	transitionIssueToDone,
} from "./jira";

// =============================================================================
// Job Types
// =============================================================================

interface SyncWorkflowJob {
	type: "sync-workflow";
	workflowId: string;
}

interface SyncWorkflowStatusJob {
	type: "sync-workflow-status";
	workflowId: string;
	newStatus: WorkflowStatus;
}

interface SyncArtifactCommentJob {
	type: "sync-artifact-comment";
	workflowId: string;
	artifactType: "scope_card" | "research" | "plan" | "review_card";
}

interface SyncMilestoneJob {
	type: "sync-milestone";
	milestoneId: string;
}

interface SyncInitiativeJob {
	type: "sync-initiative";
	initiativeId: string;
}

interface TransitionIssueToDoneJob {
	type: "transition-issue-done";
	issueKey: string;
	autarchType: "milestone" | "initiative" | "workflow";
}

interface SyncPulsesJob {
	type: "sync-pulses";
	workflowId: string;
}

interface SyncPulseStatusJob {
	type: "sync-pulse-status";
	pulseId: string;
	pulseStatus: "running" | "succeeded" | "failed" | "stopped";
}

export type JiraSyncJob =
	| SyncWorkflowJob
	| SyncWorkflowStatusJob
	| SyncArtifactCommentJob
	| SyncMilestoneJob
	| SyncInitiativeJob
	| TransitionIssueToDoneJob
	| SyncPulsesJob
	| SyncPulseStatusJob;

// =============================================================================
// Queue Implementation
// =============================================================================

class JiraSyncQueue {
	private queue: JiraSyncJob[] = [];
	private pumping = false;
	private stopped = false;

	/** Append a job to the queue. Jobs execute in strict FIFO order. */
	enqueue(job: JiraSyncJob): void {
		if (this.stopped) return;
		this.queue.push(job);
		this.pump();
	}

	/**
	 * Stop accepting new jobs and wait for the current job (if any) to finish.
	 */
	async stop(): Promise<void> {
		this.stopped = true;
		// Wait for pump to finish current item
		while (this.pumping) {
			await new Promise((r) => setTimeout(r, 50));
		}
	}

	/** Number of jobs waiting (for diagnostics). */
	get length(): number {
		return this.queue.length;
	}

	// ---------------------------------------------------------------------------
	// Pump
	// ---------------------------------------------------------------------------

	private async pump(): Promise<void> {
		if (this.pumping) return; // already running
		this.pumping = true;

		try {
			while (this.queue.length > 0) {
				const job = this.queue.shift();
				if (!job) continue;

				try {
					await this.execute(job);
				} catch (err) {
					log.jira.error(`Jira sync job failed: ${job.type}`, {
						error: err instanceof Error ? err.message : String(err),
					});
				}
			}
		} finally {
			this.pumping = false;
		}
	}

	// ---------------------------------------------------------------------------
	// Job Execution
	// ---------------------------------------------------------------------------

	private async execute(job: JiraSyncJob): Promise<void> {
		switch (job.type) {
			case "sync-workflow": {
				const repos = getRepositories();
				const workflow = await repos.workflows.getById(job.workflowId);
				if (!workflow) {
					log.jira.warn(`Workflow ${job.workflowId} not found, skipping sync`);
					return;
				}
				// Look up parent initiative to determine if workflow should link to
				// its existing Jira Story instead of creating a new one
				const initiative = await repos.roadmaps.findInitiativeByWorkflowId(
					job.workflowId,
				);
				const initiativeJira = initiative?.jiraIssueKey
					? { key: initiative.jiraIssueKey, id: initiative.jiraIssueId }
					: undefined;
				const roadmap = initiative?.roadmapId
					? await repos.roadmaps.getRoadmap(initiative.roadmapId)
					: null;
				await syncWorkflow(workflow, initiativeJira, roadmap?.title);

				return;
			}

			case "sync-workflow-status": {
				await syncWorkflowStatus(job.workflowId, job.newStatus);
				return;
			}

			case "sync-artifact-comment": {
				// Read fresh state from DB
				const repos = getRepositories();
				const workflow = await repos.workflows.getById(job.workflowId);
				if (!workflow?.jiraIssueKey) {
					log.jira.warn(
						`Workflow ${job.workflowId} has no Jira issue key, skipping artifact comment`,
					);
					return;
				}

				type ArtifactEntry = Parameters<typeof syncArtifactComment>[1];
				let entry: ArtifactEntry | null = null;

				switch (job.artifactType) {
					case "scope_card": {
						const a = await repos.artifacts.getLatestScopeCard(job.workflowId);
						if (a) entry = { type: "scope_card", artifact: a };
						break;
					}
					case "research": {
						const a = await repos.artifacts.getLatestResearchCard(
							job.workflowId,
						);
						if (a) entry = { type: "research", artifact: a };
						break;
					}
					case "plan": {
						const a = await repos.artifacts.getLatestPlan(job.workflowId);
						if (a) entry = { type: "plan", artifact: a };
						break;
					}
					case "review_card": {
						const a = await repos.artifacts.getLatestReviewCard(job.workflowId);
						if (a) entry = { type: "review_card", artifact: a };
						break;
					}
				}

				if (entry) {
					await syncArtifactComment(workflow.jiraIssueKey, entry);
				}
				return;
			}

			case "sync-milestone": {
				const repos = getRepositories();
				const milestone = await repos.roadmaps.getMilestone(job.milestoneId);
				if (!milestone) {
					log.jira.warn(
						`Milestone ${job.milestoneId} not found, skipping sync`,
					);
					return;
				}
				const roadmap = await repos.roadmaps.getRoadmap(milestone.roadmapId);
				await syncMilestone(milestone, roadmap?.title);
				return;
			}

			case "sync-initiative": {
				const repos = getRepositories();
				const initiative = await repos.roadmaps.getInitiative(job.initiativeId);
				if (!initiative) {
					log.jira.warn(
						`Initiative ${job.initiativeId} not found, skipping sync`,
					);
					return;
				}
				// Look up parent epic key for linking
				const milestone = await repos.roadmaps.getMilestone(
					initiative.milestoneId,
				);
				const roadmap = await repos.roadmaps.getRoadmap(initiative.roadmapId);
				await syncInitiative(
					initiative,
					milestone?.jiraEpicKey,
					roadmap?.title,
				);
				return;
			}

			case "sync-pulses": {
				const repos = getRepositories();
				const workflow = await repos.workflows.getById(job.workflowId);

				if (!workflow?.jiraIssueKey) {
					log.jira.warn(`Workflow ${job.workflowId} not found, skipping sync`);
					return;
				}

				const plan = await repos.artifacts.getLatestPlan(job.workflowId);

				if (!plan) {
					log.jira.warn(`No plan found for workflow ${job.workflowId}`);
					return;
				}

				const initiative = await repos.roadmaps.findInitiativeByWorkflowId(
					job.workflowId,
				);
				const roadmap = initiative?.roadmapId
					? await repos.roadmaps.getRoadmap(initiative.roadmapId)
					: null;
				await syncPulses(plan, workflow.jiraIssueKey, roadmap?.title);
				return;
			}

			case "transition-issue-done": {
				await transitionIssueToDone(job.issueKey, job.autarchType);
				return;
			}

			case "sync-pulse-status": {
				await syncPulseStatus(job.pulseId, job.pulseStatus);
				return;
			}
		}
	}
}

// =============================================================================
// Singleton
// =============================================================================

export const jiraSyncQueue = new JiraSyncQueue();
