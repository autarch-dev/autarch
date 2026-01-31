/**
 * Tests for diffs module
 *
 * Tests diff operations: getDiff, getUncommittedDiff.
 */

import { test as bunTest, describe, expect } from "bun:test";

// Use serial tests to avoid flakiness when stdin is /dev/null (Bun bug)
const test = bunTest.serial;

import { commitChanges, stageAllChanges } from "../commits";
import { getDiff, getUncommittedDiff } from "../diffs";
import { scaffoldGitRepository } from "./setup";

describe("diffs", () => {
	describe("getDiff", () => {
		test("returns empty string when no changes between commits", async () => {
			const repoRoot = scaffoldGitRepository({ createInitialCommit: true });

			// Get the current commit SHA
			const shaResult = Bun.spawnSync(["git", "rev-parse", "HEAD"], {
				cwd: repoRoot,
				stdout: "pipe",
				stderr: "pipe",
			});
			const sha = shaResult.stdout.toString().trim();

			// Get diff between the same commit (should be empty)
			const diff = await getDiff(repoRoot, sha, sha);

			expect(diff).toBe("");
		});

		test("returns diff content after commit", async () => {
			const repoRoot = scaffoldGitRepository({ createInitialCommit: true });

			// Get the first commit SHA
			const shaResult1 = Bun.spawnSync(["git", "rev-parse", "HEAD"], {
				cwd: repoRoot,
				stdout: "pipe",
				stderr: "pipe",
			});
			const sha1 = shaResult1.stdout.toString().trim();

			// Create a new file with content
			const fs = await import("node:fs");
			fs.writeFileSync(`${repoRoot}/test.txt`, "Hello, World!\n");

			// Commit the changes
			await commitChanges(repoRoot, "Add test file");

			// Get the second commit SHA
			const shaResult2 = Bun.spawnSync(["git", "rev-parse", "HEAD"], {
				cwd: repoRoot,
				stdout: "pipe",
				stderr: "pipe",
			});
			const sha2 = shaResult2.stdout.toString().trim();

			// Get the diff between commits
			const diff = await getDiff(repoRoot, sha1, sha2);

			// Verify diff contains the new file content
			expect(diff).toContain("test.txt");
			expect(diff).toContain("Hello, World!");
		});
	});

	describe("getUncommittedDiff", () => {
		test("returns empty string on clean repo", async () => {
			const repoRoot = scaffoldGitRepository({ createInitialCommit: true });

			const diff = await getUncommittedDiff(repoRoot);

			expect(diff).toBe("");
		});

		test("returns diff for uncommitted changes", async () => {
			const repoRoot = scaffoldGitRepository({ createInitialCommit: true });

			// Create a new file with content
			const fs = await import("node:fs");
			fs.writeFileSync(`${repoRoot}/uncommitted.txt`, "Uncommitted content\n");

			// Stage with stageAllChanges
			await stageAllChanges(repoRoot);

			// Get the uncommitted diff
			const diff = await getUncommittedDiff(repoRoot);

			// Verify diff shows the staged changes
			expect(diff).toContain("uncommitted.txt");
			expect(diff).toContain("Uncommitted content");
		});
	});
});
