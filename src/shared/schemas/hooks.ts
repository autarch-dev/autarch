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
