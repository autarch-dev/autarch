/**
 * Tests for commits module
 *
 * Tests commit operations: hasUncommittedChanges, getChangedFiles,
 * stageAllChanges, commitChanges, createRecoveryCheckpoint.
 */

import { describe, expect, test } from "bun:test";
import {
	commitChanges,
	createRecoveryCheckpoint,
	getChangedFiles,
	hasUncommittedChanges,
	stageAllChanges,
} from "../commits";
import { scaffoldGitRepository } from "./setup";

describe("commits", () => {
	describe("hasUncommittedChanges", () => {
		test("returns false on clean repo", async () => {
			const repoRoot = scaffoldGitRepository({ createInitialCommit: true });

			const hasChanges = await hasUncommittedChanges(repoRoot);

			expect(hasChanges).toBe(false);
		});

		test("returns true after file creation", async () => {
			const repoRoot = scaffoldGitRepository({ createInitialCommit: true });

			// Create a new file
			Bun.spawnSync(["touch", "new-file.txt"], {
				cwd: repoRoot,
				stdout: "pipe",
				stderr: "pipe",
			});

			const hasChanges = await hasUncommittedChanges(repoRoot);

			expect(hasChanges).toBe(true);
		});
	});

	describe("getChangedFiles", () => {
		test("lists modified files", async () => {
			const repoRoot = scaffoldGitRepository({ createInitialCommit: true });

			// Create some new files
			Bun.spawnSync(["touch", "file1.txt"], {
				cwd: repoRoot,
				stdout: "pipe",
				stderr: "pipe",
			});
			Bun.spawnSync(["touch", "file2.txt"], {
				cwd: repoRoot,
				stdout: "pipe",
				stderr: "pipe",
			});

			const changedFiles = await getChangedFiles(repoRoot);

			expect(changedFiles).toContain("file1.txt");
			expect(changedFiles).toContain("file2.txt");
			expect(changedFiles).toHaveLength(2);
		});
	});

	describe("stageAllChanges", () => {
		test("stages all changes (verify with git status --porcelain)", async () => {
			const repoRoot = scaffoldGitRepository({ createInitialCommit: true });

			// Create a new file (untracked)
			Bun.spawnSync(["touch", "unstaged-file.txt"], {
				cwd: repoRoot,
				stdout: "pipe",
				stderr: "pipe",
			});

			// Verify file is untracked (starts with "??")
			const beforeStatus = Bun.spawnSync(["git", "status", "--porcelain"], {
				cwd: repoRoot,
				stdout: "pipe",
				stderr: "pipe",
			});
			const beforeOutput = beforeStatus.stdout.toString().trim();
			expect(beforeOutput).toMatch(/^\?\?/); // Untracked file prefix

			// Stage all changes
			await stageAllChanges(repoRoot);

			// Verify file is now staged (starts with "A ")
			const afterStatus = Bun.spawnSync(["git", "status", "--porcelain"], {
				cwd: repoRoot,
				stdout: "pipe",
				stderr: "pipe",
			});
			const afterOutput = afterStatus.stdout.toString().trim();
			expect(afterOutput).toMatch(/^A /); // Added/staged file prefix
		});
	});

	describe("commitChanges", () => {
		test("creates commit with message (verify with git log)", async () => {
			const repoRoot = scaffoldGitRepository({ createInitialCommit: true });
			const commitMessage = "Test commit message";

			// Create a new file
			Bun.spawnSync(["touch", "commit-test-file.txt"], {
				cwd: repoRoot,
				stdout: "pipe",
				stderr: "pipe",
			});

			// Commit changes
			const sha = await commitChanges(repoRoot, commitMessage);

			// Verify SHA is a valid 40-character hex string
			expect(sha).toMatch(/^[0-9a-f]{40}$/);

			// Verify commit message with git log
			const logResult = Bun.spawnSync(
				["git", "log", "-1", "--format=%s", sha],
				{
					cwd: repoRoot,
					stdout: "pipe",
					stderr: "pipe",
				},
			);
			const logMessage = logResult.stdout.toString().trim();
			expect(logMessage).toBe(commitMessage);
		});

		test("with trailers formats message correctly with blank line separator", async () => {
			const repoRoot = scaffoldGitRepository({ createInitialCommit: true });
			const commitMessage = "Test commit with trailers";
			const trailers = {
				"Pulse-Id": "pulse-123",
				"Workflow-Id": "workflow-456",
			};

			// Create a new file
			Bun.spawnSync(["touch", "trailer-test-file.txt"], {
				cwd: repoRoot,
				stdout: "pipe",
				stderr: "pipe",
			});

			// Commit changes with trailers
			const sha = await commitChanges(repoRoot, commitMessage, trailers);

			// Verify SHA is valid
			expect(sha).toMatch(/^[0-9a-f]{40}$/);

			// Verify trailers with git log --format=%B (full message)
			const fullBodyResult = Bun.spawnSync(
				["git", "log", "-1", "--format=%B", sha],
				{
					cwd: repoRoot,
					stdout: "pipe",
					stderr: "pipe",
				},
			);
			const fullBody = fullBodyResult.stdout.toString().trim();

			// Message should contain blank line separator before trailers
			expect(fullBody).toContain(commitMessage);
			expect(fullBody).toContain("\n\n"); // Blank line separator
			expect(fullBody).toContain("Pulse-Id: pulse-123");
			expect(fullBody).toContain("Workflow-Id: workflow-456");

			// Verify trailers can be parsed with git interpret-trailers
			const trailerResult = Bun.spawnSync(
				["git", "log", "-1", "--format=%(trailers)", sha],
				{
					cwd: repoRoot,
					stdout: "pipe",
					stderr: "pipe",
				},
			);
			const trailerOutput = trailerResult.stdout.toString().trim();
			expect(trailerOutput).toContain("Pulse-Id: pulse-123");
			expect(trailerOutput).toContain("Workflow-Id: workflow-456");
		});
	});

	describe("createRecoveryCheckpoint", () => {
		test("creates WIP commit when changes exist, returns null when clean", async () => {
			const repoRoot = scaffoldGitRepository({ createInitialCommit: true });

			// First, verify returns null when no changes
			const nullResult = await createRecoveryCheckpoint(repoRoot);
			expect(nullResult).toBeNull();

			// Create a new file
			Bun.spawnSync(["touch", "recovery-test-file.txt"], {
				cwd: repoRoot,
				stdout: "pipe",
				stderr: "pipe",
			});

			// Create recovery checkpoint
			const sha = await createRecoveryCheckpoint(repoRoot);

			// Verify SHA is valid
			expect(sha).not.toBeNull();
			if (sha === null) {
				throw new Error("SHA should not be null after creating file");
			}
			expect(sha).toMatch(/^[0-9a-f]{40}$/);

			// Verify commit message contains [RECOVERY]
			const logResult = Bun.spawnSync(
				["git", "log", "-1", "--format=%s", sha],
				{
					cwd: repoRoot,
					stdout: "pipe",
					stderr: "pipe",
				},
			);
			const logMessage = logResult.stdout.toString().trim();
			expect(logMessage).toContain("[RECOVERY]");
			expect(logMessage).toContain("Work in progress");
		});
	});
});
