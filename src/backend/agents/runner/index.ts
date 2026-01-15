/**
 * Agent Runner System
 *
 * Manages agent execution, sessions, workflows, and LLM streaming.
 *
 * Usage:
 * ```typescript
 * import { initSessionManager, initWorkflowOrchestrator } from "@/backend/agents/runner";
 *
 * // Initialize (usually at app startup)
 * const sessionManager = initSessionManager(db);
 * const orchestrator = initWorkflowOrchestrator(sessionManager, db);
 *
 * // Create a workflow
 * const workflow = await orchestrator.createWorkflow("Add user auth", "Implement JWT auth");
 *
 * // Or start a channel session
 * const session = await sessionManager.startSession({
 *   contextType: "channel",
 *   contextId: "general",
 *   agentRole: "discussion",
 * });
 * ```
 */

// AgentRunner
export { AgentRunner } from "./AgentRunner";
// SessionManager
export {
	getSessionManager,
	initSessionManager,
	SessionManager,
} from "./SessionManager";
// Types
export type {
	ActiveSession,
	ArtifactType,
	RunnerConfig,
	RunOptions,
	SessionContext,
	SessionContextType,
	SessionStatus,
	StageTransitionResult,
	ToolCall,
	ToolStatus,
	Turn,
	TurnRole,
	TurnStatus,
} from "./types";
// WorkflowOrchestrator
export {
	getWorkflowOrchestrator,
	initWorkflowOrchestrator,
	WorkflowOrchestrator,
} from "./WorkflowOrchestrator";
