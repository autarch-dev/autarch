/**
 * Project database schema types
 */

// =============================================================================
// Database Interface
// =============================================================================

export interface ProjectDatabase {
	project_meta: ProjectMetaTable;
	channels: ChannelsTable;
	workflows: WorkflowsTable;
	scope_cards: ScopeCardsTable;
	research_cards: ResearchCardsTable;
	plans: PlansTable;
	sessions: SessionsTable;
	turns: TurnsTable;
	turn_messages: TurnMessagesTable;
	turn_tools: TurnToolsTable;
	turn_thoughts: TurnThoughtsTable;
}

// =============================================================================
// Project Meta
// =============================================================================

export interface ProjectMetaTable {
	key: string;
	value: string;
	updated_at: number;
}

// =============================================================================
// Channels (Discussions)
// =============================================================================

export interface ChannelsTable {
	id: string;
	name: string;
	description: string | null;
	created_at: number;
	updated_at: number;
}

// =============================================================================
// Workflows
// =============================================================================

export type WorkflowStatus =
	| "backlog"
	| "scoping"
	| "researching"
	| "planning"
	| "in_progress"
	| "review"
	| "done";

export type WorkflowPriority = "low" | "medium" | "high" | "urgent";

export type PendingArtifactType =
	| "scope_card"
	| "research"
	| "plan"
	| "review"
	| null;

export interface WorkflowsTable {
	id: string;
	title: string;
	description: string | null;
	status: WorkflowStatus;
	priority: WorkflowPriority;
	current_session_id: string | null;
	awaiting_approval: number; // 0 or 1 (SQLite boolean)
	pending_artifact_type: PendingArtifactType;
	created_at: number;
	updated_at: number;
}

// =============================================================================
// Scope Cards
// =============================================================================

export type ScopeComplexity =
	| "trivial"
	| "small"
	| "medium"
	| "large"
	| "unknown";

export type RecommendedPath = "quick" | "full";

export interface ScopeCardsTable {
	id: string;
	workflow_id: string;
	title: string;
	description: string;
	in_scope_json: string; // JSON array of strings
	out_of_scope_json: string; // JSON array of strings
	constraints_json: string | null; // JSON array of strings
	recommended_path: RecommendedPath;
	rationale: string | null;
	created_at: number;
}

// =============================================================================
// Research Cards
// =============================================================================

export interface ResearchCardsTable {
	id: string;
	workflow_id: string;
	summary: string;
	key_files_json: string; // JSON array of { path, purpose, lineRanges? }
	patterns_json: string | null; // JSON array of patterns
	dependencies_json: string | null; // JSON array of dependencies
	integration_points_json: string | null; // JSON array of integration points
	challenges_json: string | null; // JSON array of challenges
	recommendations_json: string; // JSON array of strings
	created_at: number;
}

// =============================================================================
// Plans
// =============================================================================

export interface PlansTable {
	id: string;
	workflow_id: string;
	approach_summary: string;
	pulses_json: string; // JSON array of pulse definitions
	created_at: number;
}

// =============================================================================
// Sessions
// =============================================================================

export type SessionContextType = "channel" | "workflow";

export type SessionStatus = "active" | "completed" | "error";

export interface SessionsTable {
	id: string;
	context_type: SessionContextType;
	context_id: string;
	agent_role: string; // ModelScenario value
	status: SessionStatus;
	created_at: number;
	updated_at: number;
}

// =============================================================================
// Turns
// =============================================================================

export type TurnRole = "user" | "assistant";

export type TurnStatus = "streaming" | "completed" | "error";

export interface TurnsTable {
	id: string;
	session_id: string;
	turn_index: number;
	role: TurnRole;
	status: TurnStatus;
	token_count: number | null;
	created_at: number;
	completed_at: number | null;
}

// =============================================================================
// Turn Messages
// =============================================================================

export interface TurnMessagesTable {
	id: string;
	turn_id: string;
	message_index: number;
	content: string;
	created_at: number;
}

// =============================================================================
// Turn Tools
// =============================================================================

export type ToolStatus = "pending" | "running" | "completed" | "error";

export interface TurnToolsTable {
	id: string;
	turn_id: string;
	tool_index: number;
	tool_name: string;
	reason: string | null; // The reason parameter from tool call
	input_json: string;
	output_json: string | null;
	status: ToolStatus;
	started_at: number;
	completed_at: number | null;
}

// =============================================================================
// Turn Thoughts (Extended Thinking)
// =============================================================================

export interface TurnThoughtsTable {
	id: string;
	turn_id: string;
	thought_index: number;
	content: string;
	created_at: number;
}
