/**
 * Tests for branches module
 *
 * Tests branch operations: getCurrentBranch, getCurrentCommit, branchExists,
 * createWorkflowBranch, createPulseBranch, deleteBranch.
 */

import { test as bunTest, describe, expect } from "bun:test";

// Use serial tests to avoid flakiness when stdin is /dev/null (Bun bug)
const test = bunTest.serial;

import {
	branchExists,
	createPulseBranch,
	createWorkflowBranch,
	deleteBranch,
	getCurrentBranch,
	getCurrentCommit,
} from "../branches";
import { scaffoldGitRepository } from "./setup";

describe("branches", () => {
	describe("getCurrentBranch", () => {
		test("returns 'main' after init", async () => {
			const repoRoot = scaffoldGitRepository({ createInitialCommit: true });

			const branch = await getCurrentBranch(repoRoot);

			// Default branch name is 'main' in modern git
			// Some systems may use 'master', but our scaffoldGitRepository uses 'main'
			expect(["main", "master"]).toContain(branch);
		});
	});

	describe("getCurrentCommit", () => {
		test("returns SHA after first commit", async () => {
			const repoRoot = scaffoldGitRepository({ createInitialCommit: true });

			const sha = await getCurrentCommit(repoRoot);

			// SHA should be a 40-character hex string
			expect(sha).toMatch(/^[0-9a-f]{40}$/);
		});
	});

	describe("branchExists", () => {
		test("returns false for non-existent branch", async () => {
			const repoRoot = scaffoldGitRepository({ createInitialCommit: true });

			const exists = await branchExists(repoRoot, "non-existent-branch");

			expect(exists).toBe(false);
		});

		test("returns true after branch creation", async () => {
			const repoRoot = scaffoldGitRepository({ createInitialCommit: true });
			const branchName = "feature-branch";

			// Create branch using git directly
			Bun.spawnSync(["git", "branch", branchName], {
				cwd: repoRoot,
				stdout: "pipe",
				stderr: "pipe",
			});

			const exists = await branchExists(repoRoot, branchName);

			expect(exists).toBe(true);
		});
	});

	describe("createWorkflowBranch", () => {
		test("creates branch with autarch/workflow/{id} prefix", async () => {
			const repoRoot = scaffoldGitRepository({ createInitialCommit: true });
			const workflowId = "workflow/test-workflow-123";

			const branchName = await createWorkflowBranch(repoRoot, workflowId);

			expect(branchName).toBe(`autarch/${workflowId}`);
			expect(await branchExists(repoRoot, branchName)).toBe(true);
		});
	});

	describe("createPulseBranch", () => {
		test("creates branch with autarch/pulse/{id} prefix", async () => {
			const repoRoot = scaffoldGitRepository({ createInitialCommit: true });
			const workflowId = "workflow/test-workflow-456";
			const pulseId = "pulse-001";

			// First create workflow branch
			const workflowBranch = await createWorkflowBranch(repoRoot, workflowId);

			// Then create pulse branch
			const pulseBranch = await createPulseBranch(
				repoRoot,
				workflowBranch,
				pulseId,
			);

			// Pulse branch format is: {workflowBranch}-{pulseId}
			expect(pulseBranch).toBe(`${workflowBranch}-${pulseId}`);
			expect(await branchExists(repoRoot, pulseBranch)).toBe(true);
		});
	});

	describe("deleteBranch", () => {
		test("removes branch (verify with branchExists)", async () => {
			const repoRoot = scaffoldGitRepository({ createInitialCommit: true });
			const branchName = "branch-to-delete";

			// Create the branch
			Bun.spawnSync(["git", "branch", branchName], {
				cwd: repoRoot,
				stdout: "pipe",
				stderr: "pipe",
			});

			// Verify it exists
			expect(await branchExists(repoRoot, branchName)).toBe(true);

			// Delete the branch
			await deleteBranch(repoRoot, branchName);

			// Verify it no longer exists
			expect(await branchExists(repoRoot, branchName)).toBe(false);
		});
	});
});
