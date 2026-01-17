/**
 * Types for the Agent Runner system
 *
 * NOTE: For type aliases (SessionContextType, TurnRole, etc.),
 * import directly from @/shared/schemas/*
 */

import type { ConversationRepository } from "@/backend/repositories";
import type { PendingArtifactType } from "@/shared/schemas/events";
import type {
	SessionContextType,
	SessionStatus,
	ToolStatus,
	TurnRole,
	TurnStatus,
} from "@/shared/schemas/session";
import type { ModelScenario } from "@/shared/schemas/settings";
import type { WorkflowStatus } from "@/shared/schemas/workflow";

/**
 * Artifact types that can be submitted for approval
 */
export type ArtifactType = PendingArtifactType;

// =============================================================================
// Session Types
// =============================================================================

/**
 * Context for creating a new session
 */
export interface SessionContext {
	contextType: SessionContextType;
	contextId: string;
	agentRole: ModelScenario;
}

/**
 * An active session being tracked by the SessionManager
 */
export interface ActiveSession {
	id: string;
	contextType: SessionContextType;
	contextId: string;
	agentRole: ModelScenario;
	status: SessionStatus;
	abortController: AbortController;
	createdAt: number;
}

// =============================================================================
// Turn Types
// =============================================================================

/**
 * Represents a single turn in a conversation
 */
export interface Turn {
	id: string;
	sessionId: string;
	turnIndex: number;
	role: TurnRole;
	status: TurnStatus;
	tokenCount?: number;
	/** Whether this turn should be hidden from the UI (e.g., auto-nudge messages) */
	hidden: boolean;
	createdAt: number;
	completedAt?: number;
}

// =============================================================================
// Tool Execution Types
// =============================================================================

/**
 * Represents a tool call within a turn
 */
export interface ToolCall {
	id: string;
	turnId: string;
	toolIndex: number;
	toolName: string;
	reason?: string;
	input: unknown;
	output?: unknown;
	status: ToolStatus;
	startedAt: number;
	completedAt?: number;
}

// =============================================================================
// Workflow Orchestration Types
// =============================================================================

/**
 * Result of handling a stage-completion tool
 */
export interface StageTransitionResult {
	transitioned: boolean;
	newStage?: WorkflowStatus;
	awaitingApproval: boolean;
	artifactId?: string;
}

// =============================================================================
// Runner Configuration
// =============================================================================

/**
 * Configuration passed to the AgentRunner
 */
export interface RunnerConfig {
	projectRoot: string;
	conversationRepo: ConversationRepository;
	worktreePath?: string; // For pulsing agent isolation
}

/**
 * Options for running the agent
 */
export interface RunOptions {
	signal?: AbortSignal;
	onMessageDelta?: (delta: string) => void;
	onThoughtDelta?: (delta: string) => void;
	onToolStarted?: (toolCall: ToolCall) => void;
	onToolCompleted?: (toolCall: ToolCall) => void;
	/** Hide this turn from the UI (e.g., for transition messages with approved artifacts) */
	hidden?: boolean;
}
