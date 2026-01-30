/**
 * PulseRepository - Data access for pulses
 *
 * Manages pulse lifecycle: creation, status updates, completion tracking.
 */

import type {
	PreflightBaselinesTable,
	PreflightSetupTable,
	PulseStatus,
	PulsesTable,
} from "@/backend/db/project";
import { generateId, ids } from "@/backend/utils";
import type { ProjectDb, Repository } from "./types";

// =============================================================================
// Types
// =============================================================================

export interface Pulse {
	id: string;
	workflowId: string;
	plannedPulseId?: string;
	status: PulseStatus;
	description?: string;
	pulseBranch?: string;
	worktreePath?: string;
	checkpointCommitSha?: string;
	diffArtifactId?: string;
	hasUnresolvedIssues: boolean;
	isRecoveryCheckpoint: boolean;
	rejectionCount: number;
	createdAt: number;
	startedAt?: number;
	endedAt?: number;
	failureReason?: string;
}

export interface CreatePulseData {
	workflowId: string;
	plannedPulseId?: string;
	description?: string;
}

export interface VerificationCommand {
	command: string;
	source: "build" | "lint" | "test";
}

export interface PreflightSetup {
	id: string;
	workflowId: string;
	sessionId?: string;
	status: "running" | "completed" | "failed";
	progressMessage?: string;
	errorMessage?: string;
	verificationCommands?: VerificationCommand[];
	createdAt: number;
	completedAt?: number;
}

export interface PreflightBaseline {
	id: string;
	workflowId: string;
	issueType: "error" | "warning";
	source: "build" | "lint" | "test";
	pattern: string;
	filePath?: string;
	description?: string;
	recordedAt: number;
}

export interface CreateBaselineData {
	workflowId: string;
	issueType: "error" | "warning";
	source: "build" | "lint" | "test";
	pattern: string;
	filePath?: string;
	description?: string;
}

// =============================================================================
// Repository
// =============================================================================

export class PulseRepository implements Repository {
	constructor(readonly db: ProjectDb) {}

	// ===========================================================================
	// Domain Mapping
	// ===========================================================================

	private toPulse(row: PulsesTable): Pulse {
		return {
			id: row.id,
			workflowId: row.workflow_id,
			plannedPulseId: row.planned_pulse_id ?? undefined,
			status: row.status,
			description: row.description ?? undefined,
			pulseBranch: row.pulse_branch ?? undefined,
			worktreePath: row.worktree_path ?? undefined,
			checkpointCommitSha: row.checkpoint_commit_sha ?? undefined,
			diffArtifactId: row.diff_artifact_id ?? undefined,
			hasUnresolvedIssues: row.has_unresolved_issues === 1,
			isRecoveryCheckpoint: row.is_recovery_checkpoint === 1,
			rejectionCount: row.rejection_count,
			createdAt: row.created_at,
			startedAt: row.started_at ?? undefined,
			endedAt: row.ended_at ?? undefined,
			failureReason: row.failure_reason ?? undefined,
		};
	}

	private toPreflightSetup(row: PreflightSetupTable): PreflightSetup {
		return {
			id: row.id,
			workflowId: row.workflow_id,
			sessionId: row.session_id ?? undefined,
			status: row.status,
			progressMessage: row.progress_message ?? undefined,
			errorMessage: row.error_message ?? undefined,
			verificationCommands: row.verification_commands
				? JSON.parse(row.verification_commands)
				: undefined,
			createdAt: row.created_at,
			completedAt: row.completed_at ?? undefined,
		};
	}

	private toBaseline(row: PreflightBaselinesTable): PreflightBaseline {
		return {
			id: row.id,
			workflowId: row.workflow_id,
			issueType: row.issue_type,
			source: row.source,
			pattern: row.pattern,
			filePath: row.file_path ?? undefined,
			description: row.description ?? undefined,
			recordedAt: row.recorded_at,
		};
	}

	// ===========================================================================
	// Pulse Operations
	// ===========================================================================

	/**
	 * Get a pulse by ID
	 */
	async getPulse(id: string): Promise<Pulse | null> {
		const row = await this.db
			.selectFrom("pulses")
			.selectAll()
			.where("id", "=", id)
			.executeTakeFirst();

		return row ? this.toPulse(row) : null;
	}

	/**
	 * Get all pulses for a workflow
	 */
	async getPulsesForWorkflow(workflowId: string): Promise<Pulse[]> {
		const rows = await this.db
			.selectFrom("pulses")
			.selectAll()
			.where("workflow_id", "=", workflowId)
			.orderBy("created_at", "asc")
			.execute();

		return rows.map((row) => this.toPulse(row));
	}

	/**
	 * Get the next proposed pulse for a workflow
	 */
	async getNextProposedPulse(workflowId: string): Promise<Pulse | null> {
		const row = await this.db
			.selectFrom("pulses")
			.selectAll()
			.where("workflow_id", "=", workflowId)
			.where("status", "=", "proposed")
			.orderBy("created_at", "asc")
			.executeTakeFirst();

		return row ? this.toPulse(row) : null;
	}

	/**
	 * Get the currently running pulse for a workflow
	 */
	async getRunningPulse(workflowId: string): Promise<Pulse | null> {
		const row = await this.db
			.selectFrom("pulses")
			.selectAll()
			.where("workflow_id", "=", workflowId)
			.where("status", "=", "running")
			.executeTakeFirst();

		return row ? this.toPulse(row) : null;
	}

	/**
	 * Create a new pulse
	 */
	async createPulse(data: CreatePulseData): Promise<Pulse> {
		const id = ids.pulse();
		const now = Date.now();

		await this.db
			.insertInto("pulses")
			.values({
				id,
				workflow_id: data.workflowId,
				planned_pulse_id: data.plannedPulseId ?? null,
				status: "proposed",
				description: data.description ?? null,
				pulse_branch: null,
				worktree_path: null,
				checkpoint_commit_sha: null,
				diff_artifact_id: null,
				has_unresolved_issues: 0,
				is_recovery_checkpoint: 0,
				rejection_count: 0,
				created_at: now,
				started_at: null,
				ended_at: null,
				failure_reason: null,
			})
			.execute();

		const pulse = await this.getPulse(id);
		if (!pulse) {
			throw new Error(`Failed to create pulse: ${id}`);
		}
		return pulse;
	}

	/**
	 * Create pulses from a plan's pulse definitions
	 */
	async createPulsesFromPlan(
		workflowId: string,
		pulseDefs: Array<{ id: string; description: string }>,
	): Promise<Pulse[]> {
		const pulses: Pulse[] = [];

		for (const def of pulseDefs) {
			const pulse = await this.createPulse({
				workflowId,
				plannedPulseId: def.id,
				description: def.description,
			});
			pulses.push(pulse);
		}

		return pulses;
	}

	/**
	 * Start a pulse (transition from proposed to running)
	 */
	async startPulse(
		id: string,
		pulseBranch: string,
		worktreePath: string,
	): Promise<void> {
		await this.db
			.updateTable("pulses")
			.set({
				status: "running",
				pulse_branch: pulseBranch,
				worktree_path: worktreePath,
				started_at: Date.now(),
			})
			.where("id", "=", id)
			.execute();
	}

	/**
	 * Complete a pulse successfully
	 */
	async completePulse(
		id: string,
		commitSha: string,
		hasUnresolvedIssues: boolean,
	): Promise<void> {
		await this.db
			.updateTable("pulses")
			.set({
				status: "succeeded",
				checkpoint_commit_sha: commitSha,
				has_unresolved_issues: hasUnresolvedIssues ? 1 : 0,
				ended_at: Date.now(),
			})
			.where("id", "=", id)
			.execute();
	}

	/**
	 * Fail a pulse
	 */
	async failPulse(
		id: string,
		reason: string,
		recoveryCommitSha?: string,
	): Promise<void> {
		await this.db
			.updateTable("pulses")
			.set({
				status: "failed",
				failure_reason: reason,
				checkpoint_commit_sha: recoveryCommitSha ?? null,
				is_recovery_checkpoint: recoveryCommitSha ? 1 : 0,
				ended_at: Date.now(),
			})
			.where("id", "=", id)
			.execute();
	}

	/**
	 * Stop a pulse (user cancelled)
	 */
	async stopPulse(id: string, recoveryCommitSha?: string): Promise<void> {
		await this.db
			.updateTable("pulses")
			.set({
				status: "stopped",
				checkpoint_commit_sha: recoveryCommitSha ?? null,
				is_recovery_checkpoint: recoveryCommitSha ? 1 : 0,
				ended_at: Date.now(),
			})
			.where("id", "=", id)
			.execute();
	}

	/**
	 * Increment rejection count and return the new count
	 */
	async incrementRejectionCount(id: string): Promise<number> {
		const pulse = await this.getPulse(id);
		if (!pulse) {
			throw new Error(`Pulse not found: ${id}`);
		}

		const newCount = pulse.rejectionCount + 1;
		await this.db
			.updateTable("pulses")
			.set({ rejection_count: newCount })
			.where("id", "=", id)
			.execute();

		return newCount;
	}

	/**
	 * Update pulse description (used for commit message)
	 */
	async updateDescription(id: string, description: string): Promise<void> {
		await this.db
			.updateTable("pulses")
			.set({ description })
			.where("id", "=", id)
			.execute();
	}

	// ===========================================================================
	// Preflight Operations
	// ===========================================================================

	/**
	 * Get preflight setup for a workflow
	 */
	async getPreflightSetup(workflowId: string): Promise<PreflightSetup | null> {
		const row = await this.db
			.selectFrom("preflight_setup")
			.selectAll()
			.where("workflow_id", "=", workflowId)
			.executeTakeFirst();

		return row ? this.toPreflightSetup(row) : null;
	}

	/**
	 * Create preflight setup record
	 */
	async createPreflightSetup(
		workflowId: string,
		sessionId: string,
	): Promise<PreflightSetup> {
		const id = ids.preflight();
		const now = Date.now();

		await this.db
			.insertInto("preflight_setup")
			.values({
				id,
				workflow_id: workflowId,
				session_id: sessionId,
				status: "running",
				progress_message: null,
				error_message: null,
				created_at: now,
				completed_at: null,
			})
			.execute();

		const setup = await this.getPreflightSetup(workflowId);
		if (!setup) {
			throw new Error(
				`Failed to create preflight setup for workflow: ${workflowId}`,
			);
		}
		return setup;
	}

	/**
	 * Update preflight progress message
	 */
	async updatePreflightProgress(
		workflowId: string,
		message: string,
	): Promise<void> {
		await this.db
			.updateTable("preflight_setup")
			.set({ progress_message: message })
			.where("workflow_id", "=", workflowId)
			.execute();
	}

	/**
	 * Complete preflight setup
	 */
	async completePreflightSetup(
		workflowId: string,
		verificationCommands?: VerificationCommand[],
	): Promise<void> {
		await this.db
			.updateTable("preflight_setup")
			.set({
				status: "completed",
				verification_commands: verificationCommands
					? JSON.stringify(verificationCommands)
					: null,
				completed_at: Date.now(),
			})
			.where("workflow_id", "=", workflowId)
			.execute();
	}

	/**
	 * Fail preflight setup
	 */
	async failPreflightSetup(workflowId: string, error: string): Promise<void> {
		await this.db
			.updateTable("preflight_setup")
			.set({
				status: "failed",
				error_message: error,
				completed_at: Date.now(),
			})
			.where("workflow_id", "=", workflowId)
			.execute();
	}

	// ===========================================================================
	// Baseline Operations
	// ===========================================================================

	/**
	 * Record a baseline issue
	 */
	async recordBaseline(data: CreateBaselineData): Promise<PreflightBaseline> {
		const id = ids.baseline();
		const now = Date.now();

		await this.db
			.insertInto("preflight_baselines")
			.values({
				id,
				workflow_id: data.workflowId,
				issue_type: data.issueType,
				source: data.source,
				pattern: data.pattern,
				file_path: data.filePath ?? null,
				description: data.description ?? null,
				recorded_at: now,
			})
			.execute();

		return {
			id,
			workflowId: data.workflowId,
			issueType: data.issueType,
			source: data.source,
			pattern: data.pattern,
			filePath: data.filePath,
			description: data.description,
			recordedAt: now,
		};
	}

	/**
	 * Get all baselines for a workflow
	 */
	async getBaselines(workflowId: string): Promise<PreflightBaseline[]> {
		const rows = await this.db
			.selectFrom("preflight_baselines")
			.selectAll()
			.where("workflow_id", "=", workflowId)
			.orderBy("recorded_at", "asc")
			.execute();

		return rows.map((row) => this.toBaseline(row));
	}

	/**
	 * Get baselines by source (build, lint, test)
	 */
	async getBaselinesBySource(
		workflowId: string,
		source: "build" | "lint" | "test",
	): Promise<PreflightBaseline[]> {
		const rows = await this.db
			.selectFrom("preflight_baselines")
			.selectAll()
			.where("workflow_id", "=", workflowId)
			.where("source", "=", source)
			.execute();

		return rows.map((row) => this.toBaseline(row));
	}

	/**
	 * Check if an issue matches any baseline
	 */
	async matchesBaseline(
		workflowId: string,
		source: "build" | "lint" | "test",
		errorMessage: string,
		filePath?: string,
	): Promise<boolean> {
		const baselines = await this.getBaselinesBySource(workflowId, source);

		for (const baseline of baselines) {
			// Check if pattern matches
			if (errorMessage.includes(baseline.pattern)) {
				// If baseline has a file path, it must also match
				if (baseline.filePath) {
					if (filePath?.includes(baseline.filePath)) {
						return true;
					}
				} else {
					return true;
				}
			}
		}

		return false;
	}

	/**
	 * Count baselines for a workflow
	 */
	async countBaselines(workflowId: string): Promise<number> {
		const result = await this.db
			.selectFrom("preflight_baselines")
			.select((eb) => eb.fn.count<number>("id").as("count"))
			.where("workflow_id", "=", workflowId)
			.executeTakeFirst();

		return result?.count ?? 0;
	}

	// ===========================================================================
	// Command Baseline Operations (Raw Command Outputs)
	// ===========================================================================

	/**
	 * Record a command baseline (raw stdout/stderr/exit code)
	 */
	async recordCommandBaseline(
		workflowId: string,
		command: string,
		source: string,
		stdout: string,
		stderr: string,
		exitCode: number,
	): Promise<void> {
		const id = generateId("cmdbaseline");
		const now = Date.now();

		await this.db
			.insertInto("preflight_command_baselines")
			.values({
				id,
				workflow_id: workflowId,
				command,
				source: source as "build" | "lint" | "test",
				stdout,
				stderr,
				exit_code: exitCode,
				recorded_at: now,
			})
			.execute();
	}

	/**
	 * Get a command baseline by workflow ID and command
	 */
	async getCommandBaseline(
		workflowId: string,
		command: string,
	): Promise<{ stdout: string; stderr: string; exit_code: number } | null> {
		const row = await this.db
			.selectFrom("preflight_command_baselines")
			.select(["stdout", "stderr", "exit_code"])
			.where("workflow_id", "=", workflowId)
			.where("command", "=", command)
			.executeTakeFirst();

		return row ?? null;
	}

	/**
	 * Delete all command baselines for a workflow
	 */
	async deleteCommandBaselines(workflowId: string): Promise<void> {
		await this.db
			.deleteFrom("preflight_command_baselines")
			.where("workflow_id", "=", workflowId)
			.execute();
	}

	// ===========================================================================
	// Cleanup Operations (for rewind)
	// ===========================================================================

	/**
	 * Delete all pulses for a workflow
	 */
	async deleteByWorkflow(workflowId: string): Promise<void> {
		await this.db
			.deleteFrom("pulses")
			.where("workflow_id", "=", workflowId)
			.execute();
	}

	/**
	 * Delete preflight setup for a workflow
	 */
	async deletePreflightSetup(workflowId: string): Promise<void> {
		await this.db
			.deleteFrom("preflight_setup")
			.where("workflow_id", "=", workflowId)
			.execute();
	}

	/**
	 * Delete all baselines for a workflow
	 */
	async deleteBaselines(workflowId: string): Promise<void> {
		await this.db
			.deleteFrom("preflight_baselines")
			.where("workflow_id", "=", workflowId)
			.execute();
	}
}
