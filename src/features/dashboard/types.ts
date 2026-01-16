/**
 * Types for the Project Dashboard
 *
 * NOTE: Channel type should be imported from @/shared/schemas/channel
 * NOTE: WorkflowStatus should be imported from @/shared/schemas/workflow
 */

// =============================================================================
// Navigation (UI-specific types)
// =============================================================================

export type ViewType = "channel" | "workflow";

export interface NavigationState {
	view: ViewType;
	selectedId: string | null;
}

// =============================================================================
// Legacy Types (used by mock data and WorkflowView - TODO: migrate to schemas)
// =============================================================================

/**
 * @deprecated Use Channel from @/shared/schemas/channel instead.
 * This is only kept for mockData.ts compatibility.
 */
export interface LegacyChannel {
	id: string;
	name: string;
	description?: string;
	unreadCount?: number;
	lastActivity?: Date;
}

/**
 * @deprecated Legacy message type for mock data.
 * Production code uses ChannelMessage from @/shared/schemas/channel.
 */
export interface Message {
	id: string;
	channelId: string;
	content: string;
	author: Author;
	timestamp: Date;
	isAI?: boolean;
	codeReferences?: CodeReference[];
}

export interface CodeReference {
	file: string;
	startLine: number;
	endLine: number;
	snippet: string;
}

export interface Author {
	id: string;
	name: string;
	avatar?: string;
	isAI?: boolean;
}

// =============================================================================
// Workflow Types (used by WorkflowView - TODO: wire up to backend schemas)
// =============================================================================

/**
 * @deprecated Import WorkflowStatus from @/shared/schemas/workflow instead.
 * This is kept for WorkflowView compatibility until it's wired to the backend.
 */
export type WorkflowStatus =
	| "backlog"
	| "scoping"
	| "researching"
	| "planning"
	| "in_progress"
	| "review"
	| "done";

/**
 * Legacy Workflow interface for WorkflowView.
 * TODO: Migrate to use Workflow from @/shared/schemas/workflow when backend is wired up.
 */
export interface Workflow {
	id: string;
	title: string;
	description?: string;
	status: WorkflowStatus;
	priority: "low" | "medium" | "high" | "urgent";
	createdAt: Date;
	updatedAt: Date;
	messages: WorkflowMessage[];
}

/**
 * Legacy WorkflowMessage for WorkflowView mock data.
 */
export interface WorkflowMessage {
	id: string;
	workflowId: string;
	content: string;
	author: Author;
	timestamp: Date;
	isAI?: boolean;
	phase?: WorkflowStatus;
	artifacts?: WorkflowArtifact[];
}

export interface WorkflowArtifact {
	type: "plan" | "code" | "diff" | "research";
	title: string;
	content: string;
}
