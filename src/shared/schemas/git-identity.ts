import { z } from "zod";

// =============================================================================
// Git Identity
// =============================================================================

/**
 * Schema for a saved git identity (both name and email are required).
 */
export const GitIdentitySchema = z.object({
	name: z.string().min(1, "Name is required"),
	email: z.string().min(1, "Email is required"),
});
export type GitIdentity = z.infer<typeof GitIdentitySchema>;

/**
 * Schema for git identity defaults derived from git config.
 * Values may not exist if git config is not set.
 */
export const GitIdentityDefaultsSchema = z.object({
	name: z.string().nullable(),
	email: z.string().nullable(),
});
export type GitIdentityDefaults = z.infer<typeof GitIdentityDefaultsSchema>;
