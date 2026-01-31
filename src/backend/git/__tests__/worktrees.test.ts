/**
 * Tests for worktrees module
 *
 * Tests worktree operations: getWorktreesDir, getWorktreePath, listWorktrees,
 * createWorktree, removeWorktree, checkoutInWorktree, resetWorktree, cleanupWorkflow.
 */

import { test as bunTest, describe, expect } from "bun:test";

// Use serial tests to avoid flakiness when stdin is /dev/null (Bun bug)
const test = bunTest.serial;

import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
	branchExists,
	createWorkflowBranch,
	getCurrentBranch,
} from "../branches";
import {
	checkoutInWorktree,
	cleanupWorkflow,
	createWorktree,
	getWorktreePath,
	getWorktreesDir,
	listWorktrees,
	removeWorktree,
	resetWorktree,
} from "../worktrees";
import { scaffoldGitRepository } from "./setup";

describe("worktrees", () => {
	describe("getWorktreesDir", () => {
		test("returns {repoRoot}/.autarch/worktrees", () => {
			const repoRoot = "/path/to/repo";

			const dir = getWorktreesDir(repoRoot);

			expect(dir).toBe("/path/to/repo/.autarch/worktrees");
		});
	});

	describe("getWorktreePath", () => {
		test("returns {repoRoot}/.autarch/worktrees/{id}", () => {
			const repoRoot = "/path/to/repo";
			const workflowId = "workflow-123";

			const path = getWorktreePath(repoRoot, workflowId);

			expect(path).toBe("/path/to/repo/.autarch/worktrees/workflow-123");
		});
	});

	describe("listWorktrees", () => {
		test("returns empty array initially (only main worktree)", async () => {
			const repoRoot = scaffoldGitRepository({ createInitialCommit: true });

			const worktrees = await listWorktrees(repoRoot);

			// Initially there's only the main worktree (the repo itself)
			// We consider "empty" as having just the main worktree
			expect(worktrees.length).toBe(1);
			expect(worktrees[0]?.path).toBe(repoRoot);
		});
	});

	describe("createWorktree", () => {
		test("creates directory and checks out branch (verify with existsSync)", async () => {
			const repoRoot = scaffoldGitRepository({ createInitialCommit: true });
			const workflowId = "workflow-create-test";

			// Create a workflow branch first
			const branchName = await createWorkflowBranch(repoRoot, workflowId);

			// Create the worktree
			const worktreePath = await createWorktree(
				repoRoot,
				workflowId,
				branchName,
			);

			// Verify directory was created
			expect(existsSync(worktreePath)).toBe(true);

			// Verify it's at the expected path
			expect(worktreePath).toBe(getWorktreePath(repoRoot, workflowId));

			// Verify the branch is checked out in the worktree
			const currentBranch = await getCurrentBranch(worktreePath);
			expect(currentBranch).toBe(branchName);
		});
	});

	describe("listWorktrees after creation", () => {
		test("returns created worktree info", async () => {
			const repoRoot = scaffoldGitRepository({ createInitialCommit: true });
			const workflowId = "workflow-list-test";

			// Create a workflow branch and worktree
			const branchName = await createWorkflowBranch(repoRoot, workflowId);
			const worktreePath = await createWorktree(
				repoRoot,
				workflowId,
				branchName,
			);

			const worktrees = await listWorktrees(repoRoot);

			// Should have main worktree + our created worktree
			expect(worktrees.length).toBe(2);

			// Find our created worktree
			const createdWorktree = worktrees.find((w) => w.path === worktreePath);
			expect(createdWorktree).toBeDefined();
			expect(createdWorktree?.branch).toBe(branchName);
			expect(createdWorktree?.head).toMatch(/^[0-9a-f]{40}$/);
		});
	});

	describe("checkoutInWorktree", () => {
		test("switches to branch (verify with getCurrentBranch in worktree)", async () => {
			const repoRoot = scaffoldGitRepository({ createInitialCommit: true });
			const workflowId = "workflow-checkout-test";

			// Create two branches
			const branch1 = await createWorkflowBranch(repoRoot, workflowId);
			const branch2 = "feature-branch";
			Bun.spawnSync(["git", "branch", branch2], {
				cwd: repoRoot,
				stdout: "pipe",
				stderr: "pipe",
			});

			// Create worktree on branch1
			const worktreePath = await createWorktree(repoRoot, workflowId, branch1);

			// Verify initially on branch1
			expect(await getCurrentBranch(worktreePath)).toBe(branch1);

			// Checkout branch2 in the worktree
			await checkoutInWorktree(worktreePath, branch2);

			// Verify now on branch2
			expect(await getCurrentBranch(worktreePath)).toBe(branch2);
		});
	});

	describe("resetWorktree", () => {
		test("discards uncommitted changes (create file in worktree, reset, verify file gone)", async () => {
			const repoRoot = scaffoldGitRepository({ createInitialCommit: true });
			const workflowId = "workflow-reset-test";

			// Create branch and worktree
			const branchName = await createWorkflowBranch(repoRoot, workflowId);
			const worktreePath = await createWorktree(
				repoRoot,
				workflowId,
				branchName,
			);

			// Create an uncommitted file in the worktree
			const testFilePath = join(worktreePath, "uncommitted-file.txt");
			writeFileSync(testFilePath, "This is uncommitted content");

			// Verify the file exists
			expect(existsSync(testFilePath)).toBe(true);

			// Reset the worktree
			await resetWorktree(worktreePath, branchName);

			// Verify the uncommitted file is gone
			expect(existsSync(testFilePath)).toBe(false);
		});
	});

	describe("removeWorktree", () => {
		test("deletes worktree (verify with existsSync)", async () => {
			const repoRoot = scaffoldGitRepository({ createInitialCommit: true });
			const workflowId = "workflow-remove-test";

			// Create branch and worktree
			const branchName = await createWorkflowBranch(repoRoot, workflowId);
			const worktreePath = await createWorktree(
				repoRoot,
				workflowId,
				branchName,
			);

			// Verify worktree exists
			expect(existsSync(worktreePath)).toBe(true);

			// Remove the worktree
			await removeWorktree(repoRoot, worktreePath);

			// Verify worktree is gone
			expect(existsSync(worktreePath)).toBe(false);
		});
	});

	describe("cleanupWorkflow", () => {
		test("removes worktree and optionally deletes branch (test both deleteBranch: true and false cases)", async () => {
			// Test case 1: deleteBranch: false - branch should remain
			const repoRoot1 = scaffoldGitRepository({ createInitialCommit: true });
			const workflowId1 = "workflow-cleanup-keep-branch";

			const branchName1 = await createWorkflowBranch(repoRoot1, workflowId1);
			const worktreePath1 = await createWorktree(
				repoRoot1,
				workflowId1,
				branchName1,
			);

			// Verify setup
			expect(existsSync(worktreePath1)).toBe(true);
			expect(await branchExists(repoRoot1, branchName1)).toBe(true);

			// Cleanup with deleteBranch: false
			await cleanupWorkflow(repoRoot1, workflowId1, { deleteBranch: false });

			// Worktree should be gone, branch should remain
			expect(existsSync(worktreePath1)).toBe(false);
			expect(await branchExists(repoRoot1, branchName1)).toBe(true);

			// Test case 2: deleteBranch: true - branch should be deleted
			const repoRoot2 = scaffoldGitRepository({ createInitialCommit: true });
			const workflowId2 = "workflow-cleanup-delete-branch";

			const branchName2 = await createWorkflowBranch(repoRoot2, workflowId2);
			const worktreePath2 = await createWorktree(
				repoRoot2,
				workflowId2,
				branchName2,
			);

			// Verify setup
			expect(existsSync(worktreePath2)).toBe(true);
			expect(await branchExists(repoRoot2, branchName2)).toBe(true);

			// Cleanup with deleteBranch: true
			await cleanupWorkflow(repoRoot2, workflowId2, { deleteBranch: true });

			// Both worktree and branch should be gone
			expect(existsSync(worktreePath2)).toBe(false);
			expect(await branchExists(repoRoot2, branchName2)).toBe(false);
		});
	});
});
