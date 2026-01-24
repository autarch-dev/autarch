/**
 * hooks - Post-write hook execution logic
 */

import path from "node:path";
import { log } from "@/backend/logger";
import { getPostWriteHooks } from "@/backend/services/projectSettings";
import type { PostWriteHook } from "@/shared/schemas/hooks";

// =============================================================================
// Constants
// =============================================================================

/** Timeout for hook execution in milliseconds (30 seconds) */
const HOOK_TIMEOUT_MS = 30 * 1000;

// =============================================================================
// Types
// =============================================================================

/**
 * Result of executing all post-write hooks for a file.
 */
export interface PostWriteHooksResult {
	/** Combined output from all executed hooks */
	output: string;
	/** Whether any hook with onFailure='block' failed */
	blocked: boolean;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get the shell command args for the current platform.
 * Uses cmd on Windows, sh on other platforms.
 */
export function getShellArgs(command: string): string[] {
	if (process.platform === "win32") {
		return ["cmd", "/c", command];
	}
	return ["sh", "-c", command];
}

/**
 * Substitute placeholders in a hook command with actual file paths.
 *
 * Supported placeholders:
 * - %PATH% - Relative path from project root
 * - %ABSOLUTE_PATH% - Full absolute path
 * - %DIRNAME% - Directory name containing the file
 * - %FILENAME% - Base filename
 *
 * @param command - The hook command with placeholders
 * @param filePath - Relative path to the file from project root
 * @param rootPath - Absolute path to the project root
 * @returns Command with placeholders substituted
 */
export function substituteHookPlaceholders(
	command: string,
	filePath: string,
	rootPath: string,
): string {
	const absolutePath = path.join(rootPath, filePath);
	const dirname = path.dirname(filePath);
	const filename = path.basename(filePath);

	return command
		.replace(/%PATH%/g, filePath)
		.replace(/%ABSOLUTE_PATH%/g, absolutePath)
		.replace(/%DIRNAME%/g, dirname)
		.replace(/%FILENAME%/g, filename);
}

/**
 * Execute a single hook command.
 *
 * @param hook - The hook configuration
 * @param command - The command to execute (with placeholders already substituted)
 * @param cwd - Working directory for the command
 * @returns Object with stdout, stderr, exitCode, and timedOut flag
 */
async function executeHook(
	hook: PostWriteHook,
	command: string,
	cwd: string,
): Promise<{
	stdout: string;
	stderr: string;
	exitCode: number;
	timedOut: boolean;
}> {
	log.tools.info(`Executing hook "${hook.name}": ${command} (cwd: ${cwd})`);

	let timeoutId: ReturnType<typeof setTimeout> | undefined;

	try {
		// Spawn the process with platform-aware shell args
		const proc = Bun.spawn(getShellArgs(command), {
			cwd,
			stdout: "pipe",
			stderr: "pipe",
			env: process.env,
		});

		// Create timeout promise
		const timeoutPromise = new Promise<never>((_, reject) => {
			timeoutId = setTimeout(() => {
				proc.kill();
				reject(new Error(`Hook "${hook.name}" timed out after 30 seconds`));
			}, HOOK_TIMEOUT_MS);
		});

		// Race between completion and timeout
		const [stdout, stderr, exitCode] = await Promise.race([
			Promise.all([
				new Response(proc.stdout).text(),
				new Response(proc.stderr).text(),
				proc.exited,
			]),
			timeoutPromise.then(() => {
				throw new Error("timeout");
			}),
		]);

		clearTimeout(timeoutId);
		return { stdout, stderr, exitCode, timedOut: false };
	} catch (error) {
		clearTimeout(timeoutId);
		const errorMessage =
			error instanceof Error ? error.message : "Unknown error";
		return {
			stdout: "",
			stderr: errorMessage,
			exitCode: 1,
			timedOut: errorMessage.includes("timed out"),
		};
	}
}

// =============================================================================
// Main Entry Point
// =============================================================================

/**
 * Execute all matching post-write hooks for a file.
 *
 * Hooks are fetched from project settings, filtered by glob pattern,
 * and executed sequentially. If any hook with onFailure='block' fails,
 * execution stops and blocked=true is returned.
 *
 * @param projectRoot - Absolute path to the project root
 * @param filePath - Relative path to the file that was written
 * @param rootPath - Absolute path to use as default working directory
 * @returns Combined output and blocked status
 */
export async function executePostWriteHooks(
	projectRoot: string,
	filePath: string,
	rootPath: string,
): Promise<PostWriteHooksResult> {
	// Fetch hooks configuration
	const hooks = await getPostWriteHooks(projectRoot);

	// Early return if no hooks configured
	if (hooks.length === 0) {
		log.tools.info(
			`No post-write hooks configured for project ${projectRoot}`,
		);
		return { output: "", blocked: false };
	}

	// Filter hooks by glob pattern
	const relativePath = filePath;
	const matchingHooks: PostWriteHook[] = [];

	for (const hook of hooks) {
		const glob = new Bun.Glob(hook.glob);
		if (glob.match(relativePath)) {
			matchingHooks.push(hook);
		} else {
			log.tools.debug(
				`Hook "${hook.name}" does not match glob pattern "${hook.glob}" for ${filePath}`,
			);
		}
	}

	// Early return if no matching hooks
	if (matchingHooks.length === 0) {
		log.tools.info(
			`No post-write hooks found for ${filePath}`,
		);
		return { output: "", blocked: false };
	}

	log.tools.info(
		`Running ${matchingHooks.length} post-write hook(s) for ${filePath}`,
	);

	// Execute matching hooks sequentially
	const outputParts: string[] = [];
	let blocked = false;

	for (const hook of matchingHooks) {
		// Substitute placeholders in command
		const command = substituteHookPlaceholders(
			hook.command,
			filePath,
			rootPath,
		);

		// Determine working directory
		const cwd = hook.cwd ? path.resolve(rootPath, hook.cwd) : rootPath;

		// Execute the hook
		const result = await executeHook(hook, command, cwd);
		const success = result.exitCode === 0;

		// Build output for this hook
		const hookOutput: string[] = [];
		hookOutput.push(`[Hook: ${hook.name}]`);
		if (result.stdout.trim()) {
			hookOutput.push(result.stdout.trim());
		}
		if (result.stderr.trim()) {
			hookOutput.push(result.stderr.trim());
		}
		if (!success) {
			if (result.timedOut) {
				hookOutput.push(`Hook timed out after 30 seconds`);
			} else {
				hookOutput.push(`Exit code: ${result.exitCode}`);
			}
		}
		outputParts.push(hookOutput.join("\n"));

		// Handle failure based on onFailure setting
		if (!success && hook.onFailure === "block") {
			log.tools.warn(
				`Hook "${hook.name}" failed with exit code ${result.exitCode} - blocking`,
			);
			blocked = true;
			break; // Stop execution on blocking failure
		}

		if (!success) {
			log.tools.warn(
				`Hook "${hook.name}" failed with exit code ${result.exitCode} - continuing (warn mode)`,
			);
		}
	}

	return {
		output: outputParts.join("\n\n"),
		blocked,
	};
}
