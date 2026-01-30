/**
 * Test Setup - Git repository scaffolding for tests
 *
 * Provides helpers to create temporary git repositories for testing.
 * Uses temp.track() for automatic cleanup when the process exits.
 */

import { writeFileSync } from "node:fs";
import temp from "temp";

// Enable automatic cleanup of temp directories when the process exits
temp.track();

/**
 * Options for scaffolding a git repository
 */
interface ScaffoldOptions {
	/**
	 * Whether to create an initial commit with a README file
	 * @default false
	 */
	createInitialCommit?: boolean;
}

/**
 * Create a temporary git repository for testing
 *
 * Creates a temp directory, initializes git, and configures user identity.
 * Optionally creates an initial commit if createInitialCommit is true.
 *
 * @param options - Configuration options
 * @returns The path to the temporary git repository
 */
export function scaffoldGitRepository(options: ScaffoldOptions = {}): string {
	const { createInitialCommit = false } = options;

	// Create temp directory
	const tempDir = temp.mkdirSync("git-test-");

	// Initialize git repository
	const initProc = Bun.spawnSync(["git", "init"], {
		cwd: tempDir,
		stdout: "pipe",
		stderr: "pipe",
	});
	if (initProc.exitCode !== 0) {
		throw new Error(
			`Failed to initialize git repository: ${initProc.stderr.toString()}`,
		);
	}

	// Configure user email
	const emailProc = Bun.spawnSync(
		["git", "config", "user.email", "test@example.com"],
		{
			cwd: tempDir,
			stdout: "pipe",
			stderr: "pipe",
		},
	);
	if (emailProc.exitCode !== 0) {
		throw new Error(
			`Failed to configure git user.email: ${emailProc.stderr.toString()}`,
		);
	}

	// Configure user name
	const nameProc = Bun.spawnSync(["git", "config", "user.name", "Test User"], {
		cwd: tempDir,
		stdout: "pipe",
		stderr: "pipe",
	});
	if (nameProc.exitCode !== 0) {
		throw new Error(
			`Failed to configure git user.name: ${nameProc.stderr.toString()}`,
		);
	}

	// Optionally create initial commit
	if (createInitialCommit) {
		// Create a README file
		Bun.spawnSync(["touch", "README.md"], {
			cwd: tempDir,
			stdout: "pipe",
			stderr: "pipe",
		});

		// Create .gitignore to exclude .autarch directory (worktrees are stored there)
		// This prevents worktree creation from being detected as "uncommitted changes"
		writeFileSync(`${tempDir}/.gitignore`, ".autarch/\n");

		// Stage the files
		const addProc = Bun.spawnSync(["git", "add", "README.md", ".gitignore"], {
			cwd: tempDir,
			stdout: "pipe",
			stderr: "pipe",
		});
		if (addProc.exitCode !== 0) {
			throw new Error(`Failed to stage files: ${addProc.stderr.toString()}`);
		}

		// Create the initial commit
		const commitProc = Bun.spawnSync(
			["git", "commit", "-m", "Initial commit"],
			{
				cwd: tempDir,
				stdout: "pipe",
				stderr: "pipe",
			},
		);
		if (commitProc.exitCode !== 0) {
			throw new Error(
				`Failed to create initial commit: ${commitProc.stderr.toString()}`,
			);
		}
	}

	return tempDir;
}
