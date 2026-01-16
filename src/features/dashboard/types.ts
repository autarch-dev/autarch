/**
 * Types for the Project Dashboard
 *
 * UI-specific types that don't belong in shared schemas.
 *
 * For domain types, import from:
 * - Channel: @/shared/schemas/channel
 * - Workflow: @/shared/schemas/workflow
 */

// =============================================================================
// Navigation (UI-specific types)
// =============================================================================

export type ViewType = "channel" | "workflow";

export interface NavigationState {
	view: ViewType;
	selectedId: string | null;
}
