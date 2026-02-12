/**
 * Tests for PulseRepository
 *
 * Tests all 28 public methods across pulse CRUD/queries, lifecycle management,
 * batch creation, preflight setup, baselines, command baselines, and cleanup.
 * Prerequisite: each test inserts a workflow row first.
 * Uses createTestDb() in beforeEach for a fresh in-memory database per test.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { Kysely } from "kysely";
import type { Workflow } from "@/shared/schemas/workflow";
import type { ProjectDatabase } from "../../db/project/types";
import { ids } from "../../utils/ids";
import type { Repositories } from "../types";
import { createTestDb, destroyTestDb } from "./helper";

let db: Kysely<ProjectDatabase>;
let repos: Repositories;

beforeEach(async () => {
	const testDb = await createTestDb();
	db = testDb.db;
	repos = testDb.repos;
});

afterEach(async () => {
	await destroyTestDb(db);
});

/** Helper: create a workflow as a prerequisite for pulse tests */
async function createWorkflow(): Promise<Workflow> {
	return repos.workflows.create({ title: "Test workflow" });
}

// =============================================================================
// Pulse CRUD & Queries
// =============================================================================

describe("PulseRepository", () => {
	describe("createPulse", () => {
		test("creates a pulse with correct default fields", async () => {
			const workflow = await createWorkflow();

			const pulse = await repos.pulses.createPulse({
				workflowId: workflow.id,
				description: "First pulse",
			});

			expect(pulse.id).toMatch(/^pulse_/);
			expect(pulse.workflowId).toBe(workflow.id);
			expect(pulse.status).toBe("proposed");
			expect(pulse.description).toBe("First pulse");
			expect(pulse.plannedPulseId).toBeUndefined();
			expect(pulse.pulseBranch).toBeUndefined();
			expect(pulse.worktreePath).toBeUndefined();
			expect(pulse.checkpointCommitSha).toBeUndefined();
			expect(pulse.diffArtifactId).toBeUndefined();
			expect(pulse.hasUnresolvedIssues).toBe(false);
			expect(typeof pulse.hasUnresolvedIssues).toBe("boolean");
			expect(pulse.isRecoveryCheckpoint).toBe(false);
			expect(typeof pulse.isRecoveryCheckpoint).toBe("boolean");
			expect(pulse.rejectionCount).toBe(0);
			expect(typeof pulse.createdAt).toBe("number");
			expect(pulse.startedAt).toBeUndefined();
			expect(pulse.endedAt).toBeUndefined();
			expect(pulse.failureReason).toBeUndefined();
		});
	});

	describe("getPulse", () => {
		test("retrieves a pulse by ID with all fields", async () => {
			const workflow = await createWorkflow();
			const created = await repos.pulses.createPulse({
				workflowId: workflow.id,
				description: "Retrieve me",
			});

			const found = await repos.pulses.getPulse(created.id);

			expect(found).not.toBeNull();
			expect(found?.id).toBe(created.id);
			expect(found?.workflowId).toBe(workflow.id);
			expect(found?.description).toBe("Retrieve me");
			expect(found?.status).toBe("proposed");
		});

		test("returns null for non-existent ID", async () => {
			const found = await repos.pulses.getPulse("pulse_nonexistent_000000");

			expect(found).toBeNull();
		});
	});

	describe("getPulsesForWorkflow", () => {
		test("returns all pulses for a workflow ordered by created_at", async () => {
			const workflow = await createWorkflow();
			await repos.pulses.createPulse({
				workflowId: workflow.id,
				description: "Pulse A",
			});
			await repos.pulses.createPulse({
				workflowId: workflow.id,
				description: "Pulse B",
			});

			const pulses = await repos.pulses.getPulsesForWorkflow(workflow.id);

			expect(pulses).toHaveLength(2);
			expect(pulses[0]?.description).toBe("Pulse A");
			expect(pulses[1]?.description).toBe("Pulse B");
		});

		test("returns empty array when no pulses exist", async () => {
			const workflow = await createWorkflow();

			const pulses = await repos.pulses.getPulsesForWorkflow(workflow.id);

			expect(pulses).toHaveLength(0);
		});
	});

	describe("getNextProposedPulse", () => {
		test("returns the first pulse with status proposed", async () => {
			const workflow = await createWorkflow();
			const first = await repos.pulses.createPulse({
				workflowId: workflow.id,
				description: "First proposed",
			});
			await repos.pulses.createPulse({
				workflowId: workflow.id,
				description: "Second proposed",
			});

			const next = await repos.pulses.getNextProposedPulse(workflow.id);

			expect(next).not.toBeNull();
			expect(next?.id).toBe(first.id);
			expect(next?.description).toBe("First proposed");
		});

		test("skips non-proposed pulses", async () => {
			const workflow = await createWorkflow();
			const first = await repos.pulses.createPulse({
				workflowId: workflow.id,
				description: "Will be started",
			});
			await repos.pulses.startPulse(first.id, "branch-1", "/tmp/wt1");
			const second = await repos.pulses.createPulse({
				workflowId: workflow.id,
				description: "Still proposed",
			});

			const next = await repos.pulses.getNextProposedPulse(workflow.id);

			expect(next).not.toBeNull();
			expect(next?.id).toBe(second.id);
		});

		test("returns null when no proposed pulses exist", async () => {
			const workflow = await createWorkflow();

			const next = await repos.pulses.getNextProposedPulse(workflow.id);

			expect(next).toBeNull();
		});
	});

	describe("getRunningPulse", () => {
		test("returns a pulse with status running", async () => {
			const workflow = await createWorkflow();
			const pulse = await repos.pulses.createPulse({
				workflowId: workflow.id,
				description: "Running pulse",
			});
			await repos.pulses.startPulse(pulse.id, "branch-1", "/tmp/wt1");

			const running = await repos.pulses.getRunningPulse(workflow.id);

			expect(running).not.toBeNull();
			expect(running?.id).toBe(pulse.id);
			expect(running?.status).toBe("running");
		});

		test("returns null when no pulse is running", async () => {
			const workflow = await createWorkflow();
			await repos.pulses.createPulse({
				workflowId: workflow.id,
				description: "Only proposed",
			});

			const running = await repos.pulses.getRunningPulse(workflow.id);

			expect(running).toBeNull();
		});
	});

	// ===========================================================================
	// Pulse Lifecycle
	// ===========================================================================

	describe("startPulse", () => {
		test("transitions pulse to running and sets branch/worktree/startedAt", async () => {
			const workflow = await createWorkflow();
			const pulse = await repos.pulses.createPulse({
				workflowId: workflow.id,
				description: "To start",
			});

			await repos.pulses.startPulse(
				pulse.id,
				"feature/my-branch",
				"/tmp/worktree",
			);

			const started = await repos.pulses.getPulse(pulse.id);
			expect(started).not.toBeNull();
			expect(started?.status).toBe("running");
			expect(started?.pulseBranch).toBe("feature/my-branch");
			expect(started?.worktreePath).toBe("/tmp/worktree");
			expect(typeof started?.startedAt).toBe("number");
		});
	});

	describe("completePulse", () => {
		test("transitions running pulse to succeeded with commit sha", async () => {
			const workflow = await createWorkflow();
			const pulse = await repos.pulses.createPulse({
				workflowId: workflow.id,
			});
			await repos.pulses.startPulse(pulse.id, "branch", "/tmp/wt");

			await repos.pulses.completePulse(pulse.id, "abc123def", false);

			const completed = await repos.pulses.getPulse(pulse.id);
			expect(completed).not.toBeNull();
			expect(completed?.status).toBe("succeeded");
			expect(completed?.checkpointCommitSha).toBe("abc123def");
			expect(completed?.hasUnresolvedIssues).toBe(false);
			expect(typeof completed?.endedAt).toBe("number");
		});

		test("records hasUnresolvedIssues when true", async () => {
			const workflow = await createWorkflow();
			const pulse = await repos.pulses.createPulse({
				workflowId: workflow.id,
			});
			await repos.pulses.startPulse(pulse.id, "branch", "/tmp/wt");

			await repos.pulses.completePulse(pulse.id, "abc123def", true);

			const completed = await repos.pulses.getPulse(pulse.id);
			expect(completed?.hasUnresolvedIssues).toBe(true);
		});
	});

	describe("failPulse", () => {
		test("transitions running pulse to failed with error stored", async () => {
			const workflow = await createWorkflow();
			const pulse = await repos.pulses.createPulse({
				workflowId: workflow.id,
			});
			await repos.pulses.startPulse(pulse.id, "branch", "/tmp/wt");

			await repos.pulses.failPulse(pulse.id, "Build failed: type error");

			const failed = await repos.pulses.getPulse(pulse.id);
			expect(failed).not.toBeNull();
			expect(failed?.status).toBe("failed");
			expect(failed?.failureReason).toBe("Build failed: type error");
			expect(typeof failed?.endedAt).toBe("number");
		});

		test("stores recovery commit sha when provided", async () => {
			const workflow = await createWorkflow();
			const pulse = await repos.pulses.createPulse({
				workflowId: workflow.id,
			});
			await repos.pulses.startPulse(pulse.id, "branch", "/tmp/wt");

			await repos.pulses.failPulse(
				pulse.id,
				"Lint failure",
				"recovery_sha_456",
			);

			const failed = await repos.pulses.getPulse(pulse.id);
			expect(failed?.checkpointCommitSha).toBe("recovery_sha_456");
			expect(failed?.isRecoveryCheckpoint).toBe(true);
		});
	});

	describe("stopPulse", () => {
		test("transitions running pulse to stopped", async () => {
			const workflow = await createWorkflow();
			const pulse = await repos.pulses.createPulse({
				workflowId: workflow.id,
			});
			await repos.pulses.startPulse(pulse.id, "branch", "/tmp/wt");

			await repos.pulses.stopPulse(pulse.id);

			const stopped = await repos.pulses.getPulse(pulse.id);
			expect(stopped).not.toBeNull();
			expect(stopped?.status).toBe("stopped");
			expect(typeof stopped?.endedAt).toBe("number");
		});

		test("stores recovery commit sha when provided", async () => {
			const workflow = await createWorkflow();
			const pulse = await repos.pulses.createPulse({
				workflowId: workflow.id,
			});
			await repos.pulses.startPulse(pulse.id, "branch", "/tmp/wt");

			await repos.pulses.stopPulse(pulse.id, "stop_recovery_sha");

			const stopped = await repos.pulses.getPulse(pulse.id);
			expect(stopped?.checkpointCommitSha).toBe("stop_recovery_sha");
			expect(stopped?.isRecoveryCheckpoint).toBe(true);
		});
	});

	describe("incrementRejectionCount", () => {
		test("increments rejection count and returns new value", async () => {
			const workflow = await createWorkflow();
			const pulse = await repos.pulses.createPulse({
				workflowId: workflow.id,
			});

			const count1 = await repos.pulses.incrementRejectionCount(pulse.id);
			const count2 = await repos.pulses.incrementRejectionCount(pulse.id);

			expect(count1).toBe(1);
			expect(count2).toBe(2);

			const updated = await repos.pulses.getPulse(pulse.id);
			expect(updated?.rejectionCount).toBe(2);
		});
	});

	// ===========================================================================
	// Batch Creation & Description Update
	// ===========================================================================

	describe("createPulsesFromPlan", () => {
		test("creates all pulses with correct planned IDs and descriptions", async () => {
			const workflow = await createWorkflow();
			const pulseDefs = [
				{ id: "plan_pulse_1", description: "Implement feature A" },
				{ id: "plan_pulse_2", description: "Implement feature B" },
				{ id: "plan_pulse_3", description: "Implement feature C" },
			];

			const pulses = await repos.pulses.createPulsesFromPlan(
				workflow.id,
				pulseDefs,
			);

			expect(pulses).toHaveLength(3);
			expect(pulses[0]?.plannedPulseId).toBe("plan_pulse_1");
			expect(pulses[0]?.description).toBe("Implement feature A");
			expect(pulses[1]?.plannedPulseId).toBe("plan_pulse_2");
			expect(pulses[1]?.description).toBe("Implement feature B");
			expect(pulses[2]?.plannedPulseId).toBe("plan_pulse_3");
			expect(pulses[2]?.description).toBe("Implement feature C");

			// Verify all are persisted
			const allPulses = await repos.pulses.getPulsesForWorkflow(workflow.id);
			expect(allPulses).toHaveLength(3);
		});
	});

	describe("updateDescription", () => {
		test("updates the pulse description", async () => {
			const workflow = await createWorkflow();
			const pulse = await repos.pulses.createPulse({
				workflowId: workflow.id,
				description: "Original description",
			});

			await repos.pulses.updateDescription(pulse.id, "Updated description");

			const updated = await repos.pulses.getPulse(pulse.id);
			expect(updated?.description).toBe("Updated description");
		});
	});

	// ===========================================================================
	// Preflight Setup Lifecycle
	// ===========================================================================

	describe("createPreflightSetup", () => {
		test("creates a preflight setup with running status", async () => {
			const workflow = await createWorkflow();
			const sessionId = ids.session();

			const setup = await repos.pulses.createPreflightSetup(
				workflow.id,
				sessionId,
			);

			expect(setup.id).toMatch(/^preflight_/);
			expect(setup.workflowId).toBe(workflow.id);
			expect(setup.sessionId).toBe(sessionId);
			expect(setup.status).toBe("running");
			expect(setup.progressMessage).toBeUndefined();
			expect(setup.errorMessage).toBeUndefined();
			expect(setup.verificationCommands).toBeUndefined();
			expect(typeof setup.createdAt).toBe("number");
			expect(setup.completedAt).toBeUndefined();
		});
	});

	describe("getPreflightSetup", () => {
		test("retrieves preflight setup by workflow ID", async () => {
			const workflow = await createWorkflow();
			const sessionId = ids.session();
			const created = await repos.pulses.createPreflightSetup(
				workflow.id,
				sessionId,
			);

			const found = await repos.pulses.getPreflightSetup(workflow.id);

			expect(found).not.toBeNull();
			expect(found?.id).toBe(created.id);
			expect(found?.workflowId).toBe(workflow.id);
			expect(found?.sessionId).toBe(sessionId);
		});

		test("returns null when no preflight setup exists", async () => {
			const workflow = await createWorkflow();

			const found = await repos.pulses.getPreflightSetup(workflow.id);

			expect(found).toBeNull();
		});
	});

	describe("preflight lifecycle: create → update progress → complete", () => {
		test("full success lifecycle", async () => {
			const workflow = await createWorkflow();
			const sessionId = ids.session();

			// Create
			await repos.pulses.createPreflightSetup(workflow.id, sessionId);

			// Update progress
			await repos.pulses.updatePreflightProgress(
				workflow.id,
				"Installing dependencies...",
			);
			let setup = await repos.pulses.getPreflightSetup(workflow.id);
			expect(setup?.progressMessage).toBe("Installing dependencies...");

			// Complete with verification commands
			const commands = [
				{ command: "npm run build", source: "build" as const },
				{ command: "npm run lint", source: "lint" as const },
			];
			await repos.pulses.completePreflightSetup(workflow.id, commands);

			setup = await repos.pulses.getPreflightSetup(workflow.id);
			expect(setup?.status).toBe("completed");
			expect(setup?.verificationCommands).toEqual(commands);
			expect(typeof setup?.completedAt).toBe("number");
		});
	});

	describe("preflight lifecycle: create → fail", () => {
		test("records failure with error message", async () => {
			const workflow = await createWorkflow();
			const sessionId = ids.session();

			await repos.pulses.createPreflightSetup(workflow.id, sessionId);
			await repos.pulses.failPreflightSetup(
				workflow.id,
				"Could not install dependencies",
			);

			const setup = await repos.pulses.getPreflightSetup(workflow.id);
			expect(setup?.status).toBe("failed");
			expect(setup?.errorMessage).toBe("Could not install dependencies");
			expect(typeof setup?.completedAt).toBe("number");
		});
	});

	// ===========================================================================
	// Baseline CRUD & Matching
	// ===========================================================================

	describe("recordBaseline", () => {
		test("creates a baseline and returns it with correct fields", async () => {
			const workflow = await createWorkflow();

			const baseline = await repos.pulses.recordBaseline({
				workflowId: workflow.id,
				issueType: "error",
				source: "build",
				pattern: "error TS2345",
				description: "Type mismatch",
			});

			expect(baseline.id).toMatch(/^baseline_/);
			expect(baseline.workflowId).toBe(workflow.id);
			expect(baseline.issueType).toBe("error");
			expect(baseline.source).toBe("build");
			expect(baseline.pattern).toBe("error TS2345");
			expect(baseline.filePath).toBeUndefined();
			expect(baseline.description).toBe("Type mismatch");
			expect(typeof baseline.recordedAt).toBe("number");
		});
	});

	describe("getBaselines", () => {
		test("returns all baselines for a workflow ordered by recorded_at", async () => {
			const workflow = await createWorkflow();
			await repos.pulses.recordBaseline({
				workflowId: workflow.id,
				issueType: "error",
				source: "build",
				pattern: "error TS1001",
			});
			await repos.pulses.recordBaseline({
				workflowId: workflow.id,
				issueType: "warning",
				source: "lint",
				pattern: "no-unused-vars",
			});

			const baselines = await repos.pulses.getBaselines(workflow.id);

			expect(baselines).toHaveLength(2);
			expect(baselines[0]?.pattern).toBe("error TS1001");
			expect(baselines[1]?.pattern).toBe("no-unused-vars");
		});

		test("returns empty array when no baselines exist", async () => {
			const workflow = await createWorkflow();

			const baselines = await repos.pulses.getBaselines(workflow.id);

			expect(baselines).toHaveLength(0);
		});
	});

	describe("getBaselinesBySource", () => {
		test("filters baselines by source", async () => {
			const workflow = await createWorkflow();
			await repos.pulses.recordBaseline({
				workflowId: workflow.id,
				issueType: "error",
				source: "build",
				pattern: "error TS1001",
			});
			await repos.pulses.recordBaseline({
				workflowId: workflow.id,
				issueType: "warning",
				source: "lint",
				pattern: "no-unused-vars",
			});
			await repos.pulses.recordBaseline({
				workflowId: workflow.id,
				issueType: "error",
				source: "build",
				pattern: "error TS2345",
			});

			const buildBaselines = await repos.pulses.getBaselinesBySource(
				workflow.id,
				"build",
			);

			expect(buildBaselines).toHaveLength(2);
			expect(buildBaselines.every((b) => b.source === "build")).toBe(true);
		});
	});

	describe("countBaselines", () => {
		test("returns the count of baselines for a workflow", async () => {
			const workflow = await createWorkflow();
			await repos.pulses.recordBaseline({
				workflowId: workflow.id,
				issueType: "error",
				source: "build",
				pattern: "error TS1001",
			});
			await repos.pulses.recordBaseline({
				workflowId: workflow.id,
				issueType: "warning",
				source: "lint",
				pattern: "no-unused-vars",
			});

			const count = await repos.pulses.countBaselines(workflow.id);

			expect(count).toBe(2);
		});

		test("returns 0 when no baselines exist", async () => {
			const workflow = await createWorkflow();

			const count = await repos.pulses.countBaselines(workflow.id);

			expect(count).toBe(0);
		});
	});

	describe("matchesBaseline", () => {
		test("returns true when error message includes baseline pattern", async () => {
			const workflow = await createWorkflow();
			await repos.pulses.recordBaseline({
				workflowId: workflow.id,
				issueType: "error",
				source: "typecheck" as "build",
				pattern: "error TS2345",
				filePath: undefined,
			});

			const matches = await repos.pulses.matchesBaseline(
				workflow.id,
				"typecheck" as "build",
				"src/index.ts(10,5): error TS2345: Argument of type 'string' is not assignable",
			);

			expect(matches).toBe(true);
		});

		test("returns false when error message does not include baseline pattern", async () => {
			const workflow = await createWorkflow();
			await repos.pulses.recordBaseline({
				workflowId: workflow.id,
				issueType: "error",
				source: "build",
				pattern: "error TS2345",
			});

			const matches = await repos.pulses.matchesBaseline(
				workflow.id,
				"build",
				"error TS9999: Something completely different",
			);

			expect(matches).toBe(false);
		});

		test("with filePath baseline, matches only when filePath also matches", async () => {
			const workflow = await createWorkflow();
			await repos.pulses.recordBaseline({
				workflowId: workflow.id,
				issueType: "error",
				source: "build",
				pattern: "error TS2345",
				filePath: "src/services/UserService.ts",
			});

			// Matching file path
			const matchesWithFile = await repos.pulses.matchesBaseline(
				workflow.id,
				"build",
				"error TS2345: Type mismatch",
				"src/services/UserService.ts",
			);
			expect(matchesWithFile).toBe(true);

			// Non-matching file path
			const noMatchFile = await repos.pulses.matchesBaseline(
				workflow.id,
				"build",
				"error TS2345: Type mismatch",
				"src/other/OtherFile.ts",
			);
			expect(noMatchFile).toBe(false);

			// No file path provided at all
			const noFileProvided = await repos.pulses.matchesBaseline(
				workflow.id,
				"build",
				"error TS2345: Type mismatch",
			);
			expect(noFileProvided).toBe(false);
		});
	});

	// ===========================================================================
	// Command Baselines
	// ===========================================================================

	describe("recordCommandBaseline", () => {
		test("records a command baseline", async () => {
			const workflow = await createWorkflow();

			await repos.pulses.recordCommandBaseline(
				workflow.id,
				"npm run build",
				"build",
				"Build successful\n",
				"",
				0,
			);

			const baseline = await repos.pulses.getCommandBaseline(
				workflow.id,
				"npm run build",
			);
			expect(baseline).not.toBeNull();
			expect(baseline?.stdout).toBe("Build successful\n");
			expect(baseline?.stderr).toBe("");
			expect(baseline?.exit_code).toBe(0);
		});
	});

	describe("getCommandBaseline", () => {
		test("retrieves a command baseline by workflow and command", async () => {
			const workflow = await createWorkflow();
			await repos.pulses.recordCommandBaseline(
				workflow.id,
				"npm run lint",
				"lint",
				"",
				"2 warnings\n",
				1,
			);

			const baseline = await repos.pulses.getCommandBaseline(
				workflow.id,
				"npm run lint",
			);

			expect(baseline).not.toBeNull();
			expect(baseline?.stdout).toBe("");
			expect(baseline?.stderr).toBe("2 warnings\n");
			expect(baseline?.exit_code).toBe(1);
		});

		test("returns null for non-existent command baseline", async () => {
			const workflow = await createWorkflow();

			const baseline = await repos.pulses.getCommandBaseline(
				workflow.id,
				"npm run nonexistent",
			);

			expect(baseline).toBeNull();
		});
	});

	describe("deleteCommandBaselines", () => {
		test("removes all command baselines for a workflow", async () => {
			const workflow = await createWorkflow();
			await repos.pulses.recordCommandBaseline(
				workflow.id,
				"npm run build",
				"build",
				"ok",
				"",
				0,
			);
			await repos.pulses.recordCommandBaseline(
				workflow.id,
				"npm run lint",
				"lint",
				"",
				"",
				0,
			);

			await repos.pulses.deleteCommandBaselines(workflow.id);

			const b1 = await repos.pulses.getCommandBaseline(
				workflow.id,
				"npm run build",
			);
			const b2 = await repos.pulses.getCommandBaseline(
				workflow.id,
				"npm run lint",
			);
			expect(b1).toBeNull();
			expect(b2).toBeNull();
		});
	});

	// ===========================================================================
	// Cleanup Operations
	// ===========================================================================

	describe("deleteByWorkflow", () => {
		test("removes all pulses for a workflow", async () => {
			const workflow = await createWorkflow();
			await repos.pulses.createPulse({
				workflowId: workflow.id,
				description: "Pulse 1",
			});
			await repos.pulses.createPulse({
				workflowId: workflow.id,
				description: "Pulse 2",
			});

			await repos.pulses.deleteByWorkflow(workflow.id);

			const remaining = await repos.pulses.getPulsesForWorkflow(workflow.id);
			expect(remaining).toHaveLength(0);
		});
	});

	describe("deletePreflightSetup", () => {
		test("removes the preflight setup for a workflow", async () => {
			const workflow = await createWorkflow();
			const sessionId = ids.session();
			await repos.pulses.createPreflightSetup(workflow.id, sessionId);

			await repos.pulses.deletePreflightSetup(workflow.id);

			const found = await repos.pulses.getPreflightSetup(workflow.id);
			expect(found).toBeNull();
		});
	});

	describe("deleteBaselines", () => {
		test("removes all baselines for a workflow", async () => {
			const workflow = await createWorkflow();
			await repos.pulses.recordBaseline({
				workflowId: workflow.id,
				issueType: "error",
				source: "build",
				pattern: "error TS1001",
			});
			await repos.pulses.recordBaseline({
				workflowId: workflow.id,
				issueType: "warning",
				source: "lint",
				pattern: "no-unused-vars",
			});

			await repos.pulses.deleteBaselines(workflow.id);

			const remaining = await repos.pulses.getBaselines(workflow.id);
			expect(remaining).toHaveLength(0);
			const count = await repos.pulses.countBaselines(workflow.id);
			expect(count).toBe(0);
		});
	});
});
