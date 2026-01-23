import { z } from "zod";

// =============================================================================
// Enums
// =============================================================================

export const HookOnFailure = z.enum(["block", "warn"]);
export type HookOnFailure = z.infer<typeof HookOnFailure>;

// =============================================================================
// Post-Write Hook Schema
// =============================================================================

/**
 * Schema for a single post-write hook configuration.
 * Hooks run automatically after file mutation tools (write_file, edit_file, multi_edit)
 * complete their file writes.
 */
export const PostWriteHookSchema = z.object({
	/** Unique identifier for the hook */
	id: z.string(),
	/** Human-readable name for the hook */
	name: z.string(),
	/** Shell command to execute. Supports placeholders: %PATH%, %ABSOLUTE_PATH%, %DIRNAME%, %FILENAME% */
	command: z.string(),
	/** Glob pattern to match files. Hook only runs if the written file matches. */
	glob: z.string().default("*"),
	/** Working directory for command execution. If not specified, uses project root. */
	cwd: z.string().optional(),
	/** Behavior when hook fails: 'block' fails the tool, 'warn' logs and continues */
	onFailure: HookOnFailure.default("warn"),
});
export type PostWriteHook = z.infer<typeof PostWriteHookSchema>;

/**
 * Schema for the complete post-write hooks configuration.
 * An array of hooks that are executed in order after file writes.
 */
export const PostWriteHooksConfigSchema = z.array(PostWriteHookSchema);
export type PostWriteHooksConfig = z.infer<typeof PostWriteHooksConfigSchema>;

// =============================================================================
// Hook Execution Result
// =============================================================================

/**
 * Result of executing a single hook.
 * Used to report hook execution status back to tool responses.
 */
export interface HookExecutionResult {
	/** ID of the hook that was executed */
	hookId: string;
	/** Name of the hook that was executed */
	hookName: string;
	/** Whether the hook command succeeded (exit code 0) */
	success: boolean;
	/** Combined stdout and stderr output from the hook */
	output: string;
	/** Whether this hook failure should block the tool (based on onFailure setting) */
	blocked: boolean;
}
