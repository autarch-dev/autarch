/**
 * Project database schema types
 *
 * Type aliases are imported from shared schemas to ensure consistency.
 * Database table interfaces use these types for their columns.
 *
 * NOTE: Consumers should import type aliases directly from @/shared/schemas/*
 * rather than from this file. This file only exports table interfaces.
 */

import type { PendingArtifactType } from "@/shared/schemas/events";
import type { QuestionStatus, QuestionType } from "@/shared/schemas/questions";
import type {
	SessionContextType,
	SessionStatus,
	ToolStatus,
	TurnRole,
	TurnStatus,
} from "@/shared/schemas/session";
import type {
	RecommendedPath,
	WorkflowPriority,
	WorkflowStatus,
} from "@/shared/schemas/workflow";

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
	pulses: PulsesTable;
	preflight_setup: PreflightSetupTable;
	preflight_baselines: PreflightBaselinesTable;
	preflight_command_baselines: PreflightCommandBaselinesTable;
	sessions: SessionsTable;
	subtasks: SubtasksTable;
	persona_roadmaps: PersonaRoadmapsTable;
	session_notes: SessionNotesTable;
	session_todos: SessionTodosTable;
	turns: TurnsTable;
	turn_messages: TurnMessagesTable;
	turn_tools: TurnToolsTable;
	turn_thoughts: TurnThoughtsTable;
	questions: QuestionsTable;
	review_cards: ReviewCardsTable;
	review_comments: ReviewCommentsTable;
	roadmaps: RoadmapTable;
	milestones: MilestoneTable;
	initiatives: InitiativeTable;
	vision_documents: VisionDocumentTable;
	dependencies: DependencyTable;
	cost_records: CostRecordsTable;
	stage_transitions: StageTransitionsTable;
	workflow_errors: WorkflowErrorsTable;
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

export interface WorkflowsTable {
	id: string;
	title: string;
	description: string | null;
	status: WorkflowStatus;
	priority: WorkflowPriority;
	current_session_id: string | null;
	awaiting_approval: number; // 0 or 1 (SQLite boolean)
	archived: number; // 0 or 1 (SQLite boolean)
	pending_artifact_type: PendingArtifactType | null;
	base_branch: string | null; // The branch workflow was created from (for diff calculation)
	skipped_stages: string; // JSON array of skipped stage names (e.g., '["researching", "planning"]')
	created_at: number;
	updated_at: number;
}

// =============================================================================
// Artifact Status (shared across scope cards, research cards, plans)
// =============================================================================

export type ArtifactStatus = "pending" | "approved" | "denied";

// =============================================================================
// Scope Cards
// =============================================================================

export type ScopeComplexity =
	| "trivial"
	| "small"
	| "medium"
	| "large"
	| "unknown";

export interface ScopeCardsTable {
	id: string;
	workflow_id: string;
	/** Turn ID this artifact was created in (for timeline ordering) */
	turn_id: string | null;
	title: string;
	description: string;
	in_scope_json: string; // JSON array of strings
	out_of_scope_json: string; // JSON array of strings
	constraints_json: string | null; // JSON array of strings
	recommended_path: RecommendedPath;
	rationale: string | null;
	status: ArtifactStatus;
	created_at: number;
}

// =============================================================================
// Research Cards
// =============================================================================

export interface ResearchCardsTable {
	id: string;
	workflow_id: string;
	/** Turn ID this artifact was created in (for timeline ordering) */
	turn_id: string | null;
	summary: string;
	key_files_json: string; // JSON array of { path, purpose, lineRanges? }
	patterns_json: string | null; // JSON array of patterns
	dependencies_json: string | null; // JSON array of dependencies
	integration_points_json: string | null; // JSON array of integration points
	challenges_json: string | null; // JSON array of challenges
	recommendations_json: string; // JSON array of strings
	status: ArtifactStatus;
	created_at: number;
}

// =============================================================================
// Plans
// =============================================================================

export interface PlansTable {
	id: string;
	workflow_id: string;
	/** Turn ID this artifact was created in (for timeline ordering) */
	turn_id: string | null;
	approach_summary: string;
	pulses_json: string; // JSON array of pulse definitions
	status: ArtifactStatus;
	created_at: number;
}

// =============================================================================
// Pulses
// =============================================================================

export type PulseStatus =
	| "proposed"
	| "running"
	| "succeeded"
	| "failed"
	| "stopped";

export interface PulsesTable {
	id: string;
	workflow_id: string;
	/** Reference to the planned pulse from the Plan (optional, pulses can be ad-hoc) */
	planned_pulse_id: string | null;
	status: PulseStatus;
	/** Description/summary of the pulse work (becomes commit message) */
	description: string | null;
	/** The pulse branch name (e.g., "autarch/workflow-x-pulse-y") */
	pulse_branch: string | null;
	/** Path to the worktree where this pulse executes */
	worktree_path: string | null;
	/** Commit SHA when pulse completes successfully */
	checkpoint_commit_sha: string | null;
	/** Diff artifact ID for review */
	diff_artifact_id: string | null;
	/** If true, pulse completed with acknowledged unresolved issues */
	has_unresolved_issues: number; // 0 or 1 (SQLite boolean)
	/** If true, this checkpoint was created from a failure/stop recovery */
	is_recovery_checkpoint: number; // 0 or 1 (SQLite boolean)
	/** Number of times completion was rejected (for escape hatch threshold) */
	rejection_count: number;
	created_at: number;
	started_at: number | null;
	ended_at: number | null;
	failure_reason: string | null;
}

// =============================================================================
// Preflight Setup
// =============================================================================

export type PreflightStatus = "running" | "completed" | "failed";

export interface PreflightSetupTable {
	id: string;
	workflow_id: string;
	/** Session ID for the preflight agent */
	session_id: string | null;
	status: PreflightStatus;
	/** Progress message for UI display */
	progress_message: string | null;
	/** Error message if failed */
	error_message: string | null;
	/**
	 * @deprecated Kept for backwards compatibility with existing databases.
	 * This column is no longer read - use verification_commands instead.
	 * SQLite cannot drop columns, so this remains in the schema.
	 */
	verification_instructions: string | null;
	/** Verification commands as JSON array of { command: string, source: 'build' | 'lint' | 'test' } */
	verification_commands: string | null;
	created_at: number;
	completed_at: number | null;
}

// =============================================================================
// Preflight Baselines
// =============================================================================

export type BaselineIssueType = "error" | "warning";
export type BaselineSource = "build" | "lint" | "test";

export interface PreflightBaselinesTable {
	id: string;
	workflow_id: string;
	issue_type: BaselineIssueType;
	source: BaselineSource;
	/** Error code or message pattern to match */
	pattern: string;
	/** Optional file path associated with this issue */
	file_path: string | null;
	/** Optional description for context */
	description: string | null;
	recorded_at: number;
}

// =============================================================================
// Preflight Command Baselines (Raw Command Outputs)
// =============================================================================

export interface PreflightCommandBaselinesTable {
	id: string;
	workflow_id: string;
	/** The verification command name (e.g., 'build', 'lint', 'test') */
	command: string;
	/** Source of the command: build, lint, or test */
	source: BaselineSource;
	/** Raw stdout from the command */
	stdout: string;
	/** Raw stderr from the command */
	stderr: string;
	/** Exit code from the command */
	exit_code: number;
	recorded_at: number;
}

// =============================================================================
// Sessions
// =============================================================================

export interface SessionsTable {
	id: string;
	context_type: SessionContextType;
	context_id: string;
	agent_role: string; // ModelScenario value
	status: SessionStatus;
	created_at: number;
	updated_at: number;
	/** Optional pulse ID to link execution sessions to their associated pulse */
	pulse_id: string | null;
	/** Optional parent session ID linking subagent sessions to their coordinator */
	parent_session_id: string | null;
}

// =============================================================================
// Subtasks
// =============================================================================

export type SubtaskStatus = "pending" | "running" | "completed" | "failed";

export interface SubtasksTable {
	id: string;
	parent_session_id: string;
	workflow_id: string;
	/** JSON-encoded task definition */
	task_definition: string;
	/** JSON-encoded findings/results (null until completed) */
	findings: string | null;
	status: SubtaskStatus;
	created_at: number;
	updated_at: number;
}

// =============================================================================
// Persona Roadmaps
// =============================================================================

export type PersonaRoadmapStatus =
	| "pending"
	| "running"
	| "completed"
	| "failed";

export interface PersonaRoadmapsTable {
	id: string;
	roadmap_id: string;
	persona: string;
	session_id: string | null;
	roadmap_data: string | null;
	status: PersonaRoadmapStatus;
	created_at: number;
	updated_at: number;
}

// =============================================================================
// Session Notes
// =============================================================================

export interface SessionNotesTable {
	id: string;
	session_id: string;
	context_type: SessionContextType;
	context_id: string;
	content: string;
	created_at: number;
}

// =============================================================================
// Session Todos
// =============================================================================

export interface SessionTodosTable {
	id: string;
	session_id: string;
	context_type: SessionContextType;
	context_id: string;
	title: string;
	description: string;
	checked: number;
	sort_order: number;
	created_at: number;
}

// =============================================================================
// Turns
// =============================================================================

export interface TurnsTable {
	id: string;
	session_id: string;
	turn_index: number;
	role: TurnRole;
	status: TurnStatus;
	token_count: number | null;
	prompt_tokens: number | null;
	completion_tokens: number | null;
	model_id: string | null;
	/** 1 if this turn should be hidden from UI (e.g., auto-nudge messages) */
	hidden: number;
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

// =============================================================================
// Questions (Agent-asked questions requiring user input)
// =============================================================================

export interface QuestionsTable {
	id: string;
	session_id: string;
	turn_id: string;
	question_index: number;
	type: QuestionType;
	prompt: string;
	options_json: string | null; // JSON array of strings
	answer_json: string | null; // JSON (string[] for multi/ranked, string otherwise)
	status: QuestionStatus;
	created_at: number;
	answered_at: number | null;
}

// =============================================================================
// Review Cards
// =============================================================================

export type ReviewRecommendation = "approve" | "deny" | "manual_review";

export interface ReviewCardsTable {
	id: string;
	workflow_id: string;
	/** Turn ID this artifact was created in (for timeline ordering) */
	turn_id: string | null;
	/** Recommendation from review agent - nullable until completeReview is called */
	recommendation: ReviewRecommendation | null;
	/** Summary from review agent - nullable until completeReview is called */
	summary: string | null;
	/** Suggested commit message from review agent - nullable until completeReview is called */
	suggested_commit_message: string | null;
	/** Persisted diff content captured at approval time - null until approved */
	diff_content: string | null;
	status: ArtifactStatus;
	created_at: number;
}

// =============================================================================
// Review Comments
// =============================================================================

export type ReviewCommentType = "line" | "file" | "review";
export type ReviewCommentSeverity = "High" | "Medium" | "Low";
export type ReviewCommentAuthor = "agent" | "user";

export interface ReviewCommentsTable {
	id: string;
	review_card_id: string;
	/** Type of comment: line (attached to lines), file (file-level), review (general) */
	type: ReviewCommentType;
	/** File path - required for line/file comments, null for review-level */
	file_path: string | null;
	/** Starting line number - required for line comments */
	start_line: number | null;
	/** Ending line number - optional, for multi-line comments */
	end_line: number | null;
	/** Severity: High, Medium, Low - null for user comments */
	severity: ReviewCommentSeverity | null;
	/** Category (e.g., security, performance, style, bug, architecture) - null for user comments */
	category: string | null;
	/** The comment description/content */
	description: string;
	/** Author of the comment: agent or user */
	author: ReviewCommentAuthor;
	created_at: number;
}

// =============================================================================
// Roadmaps
// =============================================================================

export interface RoadmapTable {
	id: string;
	title: string;
	description: string | null;
	status: string;
	perspective: string;
	current_session_id: string | null;
	created_at: number;
	updated_at: number;
}

// =============================================================================
// Milestones
// =============================================================================

export interface MilestoneTable {
	id: string;
	roadmap_id: string;
	title: string;
	description: string | null;
	start_date: number | null;
	end_date: number | null;
	sort_order: number;
	created_at: number;
	updated_at: number;
}

// =============================================================================
// Initiatives
// =============================================================================

export interface InitiativeTable {
	id: string;
	milestone_id: string;
	roadmap_id: string;
	title: string;
	description: string | null;
	status: string;
	priority: string;
	progress: number;
	progress_mode: string;
	workflow_id: string | null;
	size: number | null;
	sort_order: number;
	created_at: number;
	updated_at: number;
}

// =============================================================================
// Vision Documents
// =============================================================================

export interface VisionDocumentTable {
	id: string;
	roadmap_id: string;
	content: string;
	created_at: number;
	updated_at: number;
}

// =============================================================================
// Dependencies
// =============================================================================

export interface DependencyTable {
	id: string;
	source_type: string;
	source_id: string;
	target_type: string;
	target_id: string;
	created_at: number;
}

// =============================================================================
// Cost Records
// =============================================================================

export interface CostRecordsTable {
	id: string;
	context_type: SessionContextType;
	context_id: string;
	turn_id: string;
	session_id: string;
	model_id: string;
	agent_role: string;
	prompt_tokens: number;
	completion_tokens: number;
	cost_usd: number;
	created_at: number;
}

// =============================================================================
// Stage Transitions
// =============================================================================

export interface StageTransitionsTable {
	id: string;
	workflow_id: string;
	previous_stage: string;
	new_stage: string;
	timestamp: number;
	transition_type: string;
}

// =============================================================================
// Workflow Errors
// =============================================================================

export interface WorkflowErrorsTable {
	id: string;
	workflow_id: string;
	stage: string;
	error_type: string;
	error_message: string;
	timestamp: number;
}
