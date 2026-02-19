/**
 * Types for the Agent Runner system
 *
 * NOTE: For type aliases (SessionContextType, TurnRole, etc.),
 * import directly from @/shared/schemas/*
 */

import type { ConversationRepository } from "@/backend/repositories";
import type { RegisteredTool } from "@/backend/tools/types";
import type { PendingArtifactType } from "@/shared/schemas/events";
import type {
	SessionContextType,
	SessionStatus,
	ToolStatus,
	TurnRole,
	TurnStatus,
} from "@/shared/schemas/session";
import type { WorkflowStatus } from "@/shared/schemas/workflow";
import type { AgentRole as _AgentRole } from "../types";

// Re-export AgentRole for convenience
export type { AgentRole } from "../types";

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
	agentRole: _AgentRole;
	/** Optional pulse ID to link execution sessions to their associated pulse */
	pulseId?: string;
	/** Parent roadmap ID — included for persona/synthesis sessions so the frontend can associate them without a race */
	roadmapId?: string;
}

/**
 * An active session being tracked by the SessionManager
 */
export interface ActiveSession {
	id: string;
	contextType: SessionContextType;
	contextId: string;
	agentRole: _AgentRole;
	status: SessionStatus;
	abortController: AbortController;
	createdAt: number;
	/** Pulse ID for execution sessions (links session to specific pulse) */
	pulseId?: string;
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
	promptTokens?: number;
	completionTokens?: number;
	modelId?: string;
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
	originalToolCallId: string;
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
	/** Override the tool set from the agent registry. When provided, the agent keeps its persona system prompt but uses these tools instead. */
	toolsOverride?: RegisteredTool[];
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

	/** Optional override for the role used for attribution (defaults to the session agent role) */
	agentRole?: _AgentRole;
	/** Workflow identifier for observability/attribution */
	workflowId?: string | null;
	/** Stage identifier within the workflow (e.g., "plan", "execute") */
	workflowStage?: string | null;
	/** Knowledge injection metadata (only present when knowledge was appended to agent context) */
	knowledgeInjection?: {
		text: string;
		queryText: string;
		tokenBudget: number;
		truncated: boolean;
		items: Array<{
			knowledgeItemId: string;
			similarity: number;
		}>;
	};
}
