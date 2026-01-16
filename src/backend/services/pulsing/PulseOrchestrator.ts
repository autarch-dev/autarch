/**
 * PulseOrchestrator - Manages sequential pulse execution
 *
 * Coordinates the pulsing phase of workflows:
 * - Creates workflow branches and worktrees
 * - Runs preflight setup
 * - Executes pulses sequentially
 * - Handles completion, validation, and merging
 * - Manages the transition to review
 */

import { findRepoRoot } from "@/backend/git";
import {
	checkoutInWorktree,
	commitChanges,
	createPulseBranch,
	createRecoveryCheckpoint,
	createWorkflowBranch,
	createWorktree,
	getCurrentBranch,
	mergePulseBranch,
} from "@/backend/git/worktree";
import { log } from "@/backend/logger";
import type {
	PreflightSetup,
	Pulse,
	PulseRepository,
} from "@/backend/repositories/PulseRepository";

// =============================================================================
// Types
// =============================================================================

export interface PulseOrchestratorConfig {
	pulseRepo: PulseRepository;
	projectRoot: string;
}

export interface StartPulsingResult {
	success: boolean;
	workflowBranch?: string;
	worktreePath?: string;
	error?: string;
}

export interface PulseCompletionResult {
	success: boolean;
	commitSha?: string;
	hasMorePulses: boolean;
	error?: string;
}

// =============================================================================
// PulseOrchestrator
// =============================================================================

export class PulseOrchestrator {
	private pulseRepo: PulseRepository;
	private projectRoot: string;

	constructor(config: PulseOrchestratorConfig) {
		this.pulseRepo = config.pulseRepo;
		this.projectRoot = config.projectRoot;
	}

	// ===========================================================================
	// Workflow Setup
	// ===========================================================================

	/**
	 * Initialize pulsing for a workflow
	 *
	 * Creates the workflow branch and worktree, preparing for preflight.
	 *
	 * @param workflowId - The workflow ID
	 * @param baseBranch - Optional base branch (defaults to current)
	 */
	async initializePulsing(
		workflowId: string,
		baseBranch?: string,
	): Promise<StartPulsingResult> {
		try {
			const repoRoot = findRepoRoot(this.projectRoot);

			// Get the base branch if not specified
			const base = baseBranch ?? (await getCurrentBranch(repoRoot));

			// Create workflow branch
			const workflowBranch = await createWorkflowBranch(
				repoRoot,
				workflowId,
				base,
			);

			// Create worktree
			const worktreePath = await createWorktree(
				repoRoot,
				workflowId,
				workflowBranch,
			);

			log.workflow.info(
				`Initialized pulsing for workflow ${workflowId}: branch=${workflowBranch}, worktree=${worktreePath}`,
			);

			return {
				success: true,
				workflowBranch,
				worktreePath,
			};
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Failed to initialize pulsing";
			log.workflow.error(`Failed to initialize pulsing: ${errorMessage}`);

			return {
				success: false,
				error: errorMessage,
			};
		}
	}

	// ===========================================================================
	// Preflight
	// ===========================================================================

	/**
	 * Create preflight setup record
	 */
	async createPreflightSetup(
		workflowId: string,
		sessionId: string,
	): Promise<PreflightSetup> {
		return this.pulseRepo.createPreflightSetup(workflowId, sessionId);
	}

	/**
	 * Check if preflight is complete for a workflow
	 */
	async isPreflightComplete(workflowId: string): Promise<boolean> {
		const setup = await this.pulseRepo.getPreflightSetup(workflowId);
		return setup?.status === "completed";
	}

	/**
	 * Check if preflight failed
	 */
	async isPreflightFailed(workflowId: string): Promise<boolean> {
		const setup = await this.pulseRepo.getPreflightSetup(workflowId);
		return setup?.status === "failed";
	}

	// ===========================================================================
	// Pulse Execution
	// ===========================================================================

	/**
	 * Create pulses from plan definitions
	 */
	async createPulsesFromPlan(
		workflowId: string,
		pulseDefs: Array<{ id: string; title: string; description: string }>,
	): Promise<Pulse[]> {
		return this.pulseRepo.createPulsesFromPlan(
			workflowId,
			pulseDefs.map((p) => ({
				id: p.id,
				description: `${p.title}: ${p.description}`,
			})),
		);
	}

	/**
	 * Start the next pulse in the queue
	 *
	 * @param workflowId - The workflow ID
	 * @param worktreePath - Path to the worktree
	 * @returns The started pulse, or null if no more pulses
	 */
	async startNextPulse(
		workflowId: string,
		worktreePath: string,
	): Promise<Pulse | null> {
		// Get next proposed pulse
		const pulse = await this.pulseRepo.getNextProposedPulse(workflowId);
		if (!pulse) {
			return null;
		}

		const repoRoot = findRepoRoot(this.projectRoot);
		const workflowBranch = `autarch/${workflowId}`;

		// Create pulse branch
		const pulseBranch = await createPulseBranch(
			repoRoot,
			workflowBranch,
			pulse.id,
		);

		// Checkout pulse branch in worktree
		await checkoutInWorktree(worktreePath, pulseBranch);

		// Update pulse status
		await this.pulseRepo.startPulse(pulse.id, pulseBranch, worktreePath);

		log.workflow.info(`Started pulse ${pulse.id} on branch ${pulseBranch}`);

		return this.pulseRepo.getPulse(pulse.id);
	}

	/**
	 * Get the currently running pulse for a workflow
	 */
	async getRunningPulse(workflowId: string): Promise<Pulse | null> {
		return this.pulseRepo.getRunningPulse(workflowId);
	}

	/**
	 * Complete a pulse successfully
	 *
	 * Commits changes, merges to workflow branch, and prepares for next pulse.
	 */
	async completePulse(
		pulseId: string,
		commitMessage: string,
		hasUnresolvedIssues: boolean,
	): Promise<PulseCompletionResult> {
		const pulse = await this.pulseRepo.getPulse(pulseId);
		if (!pulse) {
			return { success: false, hasMorePulses: false, error: "Pulse not found" };
		}

		if (pulse.status !== "running") {
			return {
				success: false,
				hasMorePulses: false,
				error: `Pulse is not running (status: ${pulse.status})`,
			};
		}

		if (!pulse.worktreePath || !pulse.pulseBranch) {
			return {
				success: false,
				hasMorePulses: false,
				error: "Pulse missing worktree or branch information",
			};
		}

		try {
			const repoRoot = findRepoRoot(this.projectRoot);
			const workflowBranch = `autarch/${pulse.workflowId}`;

			// Commit changes in the pulse branch
			const commitSha = await commitChanges(pulse.worktreePath, commitMessage);

			// Merge pulse branch into workflow branch
			await mergePulseBranch(
				repoRoot,
				pulse.worktreePath,
				workflowBranch,
				pulse.pulseBranch,
			);

			// Update pulse record
			await this.pulseRepo.completePulse(
				pulseId,
				commitSha,
				hasUnresolvedIssues,
			);
			await this.pulseRepo.updateDescription(pulseId, commitMessage);

			// Check if there are more pulses
			const nextPulse = await this.pulseRepo.getNextProposedPulse(
				pulse.workflowId,
			);

			log.workflow.info(`Completed pulse ${pulseId}: ${commitSha.slice(0, 8)}`);

			return {
				success: true,
				commitSha,
				hasMorePulses: nextPulse !== null,
			};
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Failed to complete pulse";
			log.workflow.error(`Failed to complete pulse: ${errorMessage}`);

			return {
				success: false,
				hasMorePulses: false,
				error: errorMessage,
			};
		}
	}

	/**
	 * Fail a pulse
	 *
	 * Creates a recovery checkpoint if there are uncommitted changes.
	 */
	async failPulse(pulseId: string, reason: string): Promise<void> {
		const pulse = await this.pulseRepo.getPulse(pulseId);
		if (!pulse || !pulse.worktreePath) {
			await this.pulseRepo.failPulse(pulseId, reason);
			return;
		}

		// Try to create a recovery checkpoint
		let recoveryCommitSha: string | undefined;
		try {
			const sha = await createRecoveryCheckpoint(pulse.worktreePath);
			if (sha) {
				recoveryCommitSha = sha;
				log.workflow.info(`Created recovery checkpoint: ${sha.slice(0, 8)}`);
			}
		} catch {
			log.workflow.warn("Could not create recovery checkpoint");
		}

		await this.pulseRepo.failPulse(pulseId, reason, recoveryCommitSha);
		log.workflow.info(`Failed pulse ${pulseId}: ${reason}`);
	}

	/**
	 * Stop a pulse (user cancelled)
	 */
	async stopPulse(pulseId: string): Promise<void> {
		const pulse = await this.pulseRepo.getPulse(pulseId);
		if (!pulse || !pulse.worktreePath) {
			await this.pulseRepo.stopPulse(pulseId);
			return;
		}

		// Try to create a recovery checkpoint
		let recoveryCommitSha: string | undefined;
		try {
			const sha = await createRecoveryCheckpoint(pulse.worktreePath);
			if (sha) {
				recoveryCommitSha = sha;
			}
		} catch {
			// Ignore errors
		}

		await this.pulseRepo.stopPulse(pulseId, recoveryCommitSha);
		log.workflow.info(`Stopped pulse ${pulseId}`);
	}

	// ===========================================================================
	// Completion Validation
	// ===========================================================================

	/**
	 * Increment rejection count for a pulse
	 * Returns the new count
	 */
	async incrementRejectionCount(pulseId: string): Promise<number> {
		return this.pulseRepo.incrementRejectionCount(pulseId);
	}

	/**
	 * Get the current rejection count for a pulse
	 */
	async getRejectionCount(pulseId: string): Promise<number> {
		const pulse = await this.pulseRepo.getPulse(pulseId);
		return pulse?.rejectionCount ?? 0;
	}

	// ===========================================================================
	// Query Methods
	// ===========================================================================

	/**
	 * Get all pulses for a workflow
	 */
	async getPulses(workflowId: string): Promise<Pulse[]> {
		return this.pulseRepo.getPulsesForWorkflow(workflowId);
	}

	/**
	 * Check if all pulses are complete
	 */
	async areAllPulsesComplete(workflowId: string): Promise<boolean> {
		const pulses = await this.pulseRepo.getPulsesForWorkflow(workflowId);
		if (pulses.length === 0) {
			return false;
		}

		return pulses.every(
			(p) =>
				p.status === "succeeded" ||
				p.status === "failed" ||
				p.status === "stopped",
		);
	}

	/**
	 * Check if any pulse has unresolved issues (requires human review)
	 */
	async hasUnresolvedIssues(workflowId: string): Promise<boolean> {
		const pulses = await this.pulseRepo.getPulsesForWorkflow(workflowId);
		return pulses.some((p) => p.hasUnresolvedIssues);
	}
}

// =============================================================================
// Singleton Instance
// =============================================================================

let orchestratorInstance: PulseOrchestrator | null = null;

/**
 * Get the singleton PulseOrchestrator instance
 */
export function getPulseOrchestrator(): PulseOrchestrator {
	if (!orchestratorInstance) {
		throw new Error(
			"PulseOrchestrator not initialized. Call initPulseOrchestrator first.",
		);
	}
	return orchestratorInstance;
}

/**
 * Initialize the singleton PulseOrchestrator instance
 */
export function initPulseOrchestrator(
	config: PulseOrchestratorConfig,
): PulseOrchestrator {
	orchestratorInstance = new PulseOrchestrator(config);
	return orchestratorInstance;
}
