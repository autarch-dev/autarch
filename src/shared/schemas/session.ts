import { z } from "zod";

// =============================================================================
// Session Status
// =============================================================================

export const SessionStatusSchema = z.enum(["active", "completed", "error"]);
export type SessionStatus = z.infer<typeof SessionStatusSchema>;

// =============================================================================
// Turn Status
// =============================================================================

export const TurnStatusSchema = z.enum(["streaming", "completed", "error"]);
export type TurnStatus = z.infer<typeof TurnStatusSchema>;

// =============================================================================
// Tool Status
// =============================================================================

export const ToolStatusSchema = z.enum([
	"pending",
	"running",
	"completed",
	"error",
]);
export type ToolStatus = z.infer<typeof ToolStatusSchema>;

// =============================================================================
// Re-exports from events.ts for convenience
// =============================================================================

export type { SessionContextType, TurnRole } from "./events";
export { SessionContextTypeSchema, TurnRoleSchema } from "./events";
