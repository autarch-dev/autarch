import { z } from "zod";

// =============================================================================
// Indexing Progress Events
// =============================================================================

export const IndexingPhase = z.enum([
	"analyzing",
	"started",
	"in_progress",
	"completed",
]);
export type IndexingPhase = z.infer<typeof IndexingPhase>;

export const IndexingProgressPayloadSchema = z.object({
	phase: IndexingPhase,
	filesProcessed: z.number(),
	totalFiles: z.number(),
	bytesProcessed: z.number(),
	totalBytes: z.number(),
});
export type IndexingProgressPayload = z.infer<
	typeof IndexingProgressPayloadSchema
>;

export const IndexingProgressEventSchema = z.object({
	type: z.literal("indexing:progress"),
	payload: IndexingProgressPayloadSchema,
});
export type IndexingProgressEvent = z.infer<typeof IndexingProgressEventSchema>;

// =============================================================================
// Workflow Events
// =============================================================================

import { WorkflowStatusSchema } from "./workflow";

export const PendingArtifactTypeSchema = z.enum([
	"scope_card",
	"research",
	"plan",
	"review_card",
]);
export type PendingArtifactType = z.infer<typeof PendingArtifactTypeSchema>;

// workflow:created
export const WorkflowCreatedPayloadSchema = z.object({
	workflowId: z.string(),
	title: z.string(),
	status: WorkflowStatusSchema,
});
export type WorkflowCreatedPayload = z.infer<
	typeof WorkflowCreatedPayloadSchema
>;

export const WorkflowCreatedEventSchema = z.object({
	type: z.literal("workflow:created"),
	payload: WorkflowCreatedPayloadSchema,
});
export type WorkflowCreatedEvent = z.infer<typeof WorkflowCreatedEventSchema>;

// workflow:approval_needed
export const WorkflowApprovalNeededPayloadSchema = z.object({
	workflowId: z.string(),
	artifactType: PendingArtifactTypeSchema,
	artifactId: z.string(),
});
export type WorkflowApprovalNeededPayload = z.infer<
	typeof WorkflowApprovalNeededPayloadSchema
>;

export const WorkflowApprovalNeededEventSchema = z.object({
	type: z.literal("workflow:approval_needed"),
	payload: WorkflowApprovalNeededPayloadSchema,
});
export type WorkflowApprovalNeededEvent = z.infer<
	typeof WorkflowApprovalNeededEventSchema
>;

// workflow:stage_changed
export const WorkflowStageChangedPayloadSchema = z.object({
	workflowId: z.string(),
	previousStage: WorkflowStatusSchema,
	newStage: WorkflowStatusSchema,
	sessionId: z.string().optional(),
});
export type WorkflowStageChangedPayload = z.infer<
	typeof WorkflowStageChangedPayloadSchema
>;

export const WorkflowStageChangedEventSchema = z.object({
	type: z.literal("workflow:stage_changed"),
	payload: WorkflowStageChangedPayloadSchema,
});
export type WorkflowStageChangedEvent = z.infer<
	typeof WorkflowStageChangedEventSchema
>;

// workflow:completed
export const WorkflowCompletedPayloadSchema = z.object({
	workflowId: z.string(),
});
export type WorkflowCompletedPayload = z.infer<
	typeof WorkflowCompletedPayloadSchema
>;

export const WorkflowCompletedEventSchema = z.object({
	type: z.literal("workflow:completed"),
	payload: WorkflowCompletedPayloadSchema,
});
export type WorkflowCompletedEvent = z.infer<
	typeof WorkflowCompletedEventSchema
>;

// workflow:error
export const WorkflowErrorPayloadSchema = z.object({
	workflowId: z.string(),
	error: z.string(),
});
export type WorkflowErrorPayload = z.infer<typeof WorkflowErrorPayloadSchema>;

export const WorkflowErrorEventSchema = z.object({
	type: z.literal("workflow:error"),
	payload: WorkflowErrorPayloadSchema,
});
export type WorkflowErrorEvent = z.infer<typeof WorkflowErrorEventSchema>;

// =============================================================================
// Channel Events
// =============================================================================

// channel:created
export const ChannelCreatedPayloadSchema = z.object({
	channelId: z.string(),
	name: z.string(),
	description: z.string().optional(),
});
export type ChannelCreatedPayload = z.infer<typeof ChannelCreatedPayloadSchema>;

export const ChannelCreatedEventSchema = z.object({
	type: z.literal("channel:created"),
	payload: ChannelCreatedPayloadSchema,
});
export type ChannelCreatedEvent = z.infer<typeof ChannelCreatedEventSchema>;

// channel:deleted
export const ChannelDeletedPayloadSchema = z.object({
	channelId: z.string(),
});
export type ChannelDeletedPayload = z.infer<typeof ChannelDeletedPayloadSchema>;

export const ChannelDeletedEventSchema = z.object({
	type: z.literal("channel:deleted"),
	payload: ChannelDeletedPayloadSchema,
});
export type ChannelDeletedEvent = z.infer<typeof ChannelDeletedEventSchema>;

// =============================================================================
// Session Events
// =============================================================================

export const SessionContextTypeSchema = z.enum(["channel", "workflow"]);
export type SessionContextType = z.infer<typeof SessionContextTypeSchema>;

// session:started
export const SessionStartedPayloadSchema = z.object({
	sessionId: z.string(),
	contextType: SessionContextTypeSchema,
	contextId: z.string(),
	agentRole: z.string(),
});
export type SessionStartedPayload = z.infer<typeof SessionStartedPayloadSchema>;

export const SessionStartedEventSchema = z.object({
	type: z.literal("session:started"),
	payload: SessionStartedPayloadSchema,
});
export type SessionStartedEvent = z.infer<typeof SessionStartedEventSchema>;

// session:completed
export const SessionCompletedPayloadSchema = z.object({
	sessionId: z.string(),
});
export type SessionCompletedPayload = z.infer<
	typeof SessionCompletedPayloadSchema
>;

export const SessionCompletedEventSchema = z.object({
	type: z.literal("session:completed"),
	payload: SessionCompletedPayloadSchema,
});
export type SessionCompletedEvent = z.infer<typeof SessionCompletedEventSchema>;

// session:error
export const SessionErrorPayloadSchema = z.object({
	sessionId: z.string(),
	error: z.string(),
});
export type SessionErrorPayload = z.infer<typeof SessionErrorPayloadSchema>;

export const SessionErrorEventSchema = z.object({
	type: z.literal("session:error"),
	payload: SessionErrorPayloadSchema,
});
export type SessionErrorEvent = z.infer<typeof SessionErrorEventSchema>;

// =============================================================================
// Turn Events
// =============================================================================

export const TurnRoleSchema = z.enum(["user", "assistant"]);
export type TurnRole = z.infer<typeof TurnRoleSchema>;

// turn:started
export const TurnStartedPayloadSchema = z.object({
	sessionId: z.string(),
	turnId: z.string(),
	role: TurnRoleSchema,
	/** Context type (channel or workflow) */
	contextType: z.enum(["channel", "workflow"]).optional(),
	/** Context ID (channel ID or workflow ID) - enables direct routing without session lookup */
	contextId: z.string().optional(),
	/** Agent role from session (e.g., scoping, research, planning, execution) */
	agentRole: z.string().optional(),
	/** Pulse ID for execution sessions (links turn to specific pulse) */
	pulseId: z.string().optional(),
});
export type TurnStartedPayload = z.infer<typeof TurnStartedPayloadSchema>;

export const TurnStartedEventSchema = z.object({
	type: z.literal("turn:started"),
	payload: TurnStartedPayloadSchema,
});
export type TurnStartedEvent = z.infer<typeof TurnStartedEventSchema>;

// turn:completed
export const TurnCompletedPayloadSchema = z.object({
	sessionId: z.string(),
	turnId: z.string(),
	tokenCount: z.number().optional(),
	/** Calculated cost for this turn (if available) */
	cost: z.number().optional(),
	/** Context type (channel or workflow) */
	contextType: z.enum(["channel", "workflow"]).optional(),
	/** Context ID (channel ID or workflow ID) - enables direct routing without session lookup */
	contextId: z.string().optional(),
	/** Agent role from session (e.g., scoping, research, planning, execution) */
	agentRole: z.string().optional(),
	/** Pulse ID for execution sessions (links turn to specific pulse) */
	pulseId: z.string().optional(),
});
export type TurnCompletedPayload = z.infer<typeof TurnCompletedPayloadSchema>;

export const TurnCompletedEventSchema = z.object({
	type: z.literal("turn:completed"),
	payload: TurnCompletedPayloadSchema,
});
export type TurnCompletedEvent = z.infer<typeof TurnCompletedEventSchema>;

// =============================================================================
// Streaming Delta Events
// =============================================================================

// turn:message_delta
export const TurnMessageDeltaPayloadSchema = z.object({
	sessionId: z.string(),
	turnId: z.string(),
	segmentIndex: z.number().default(0), // Index of the current text segment (increments after tool calls)
	delta: z.string(),
	/** Context type (channel or workflow) */
	contextType: z.enum(["channel", "workflow"]).optional(),
	/** Context ID (channel ID or workflow ID) - enables direct routing without session lookup */
	contextId: z.string().optional(),
	/** Agent role from session - enables streaming message creation on reconnect */
	agentRole: z.string().optional(),
	/** Pulse ID for execution sessions - enables streaming message creation on reconnect */
	pulseId: z.string().optional(),
});
export type TurnMessageDeltaPayload = z.infer<
	typeof TurnMessageDeltaPayloadSchema
>;

export const TurnMessageDeltaEventSchema = z.object({
	type: z.literal("turn:message_delta"),
	payload: TurnMessageDeltaPayloadSchema,
});
export type TurnMessageDeltaEvent = z.infer<typeof TurnMessageDeltaEventSchema>;

// turn:segment_complete - Emitted when a text segment is finalized (before a tool call)
export const TurnSegmentCompletePayloadSchema = z.object({
	sessionId: z.string(),
	turnId: z.string(),
	segmentIndex: z.number(),
	content: z.string(),
});
export type TurnSegmentCompletePayload = z.infer<
	typeof TurnSegmentCompletePayloadSchema
>;

export const TurnSegmentCompleteEventSchema = z.object({
	type: z.literal("turn:segment_complete"),
	payload: TurnSegmentCompletePayloadSchema,
});
export type TurnSegmentCompleteEvent = z.infer<
	typeof TurnSegmentCompleteEventSchema
>;

// turn:thought_delta
export const TurnThoughtDeltaPayloadSchema = z.object({
	sessionId: z.string(),
	turnId: z.string(),
	delta: z.string(),
});
export type TurnThoughtDeltaPayload = z.infer<
	typeof TurnThoughtDeltaPayloadSchema
>;

export const TurnThoughtDeltaEventSchema = z.object({
	type: z.literal("turn:thought_delta"),
	payload: TurnThoughtDeltaPayloadSchema,
});
export type TurnThoughtDeltaEvent = z.infer<typeof TurnThoughtDeltaEventSchema>;

// =============================================================================
// Tool Events
// =============================================================================

// turn:tool_started
export const TurnToolStartedPayloadSchema = z.object({
	sessionId: z.string(),
	turnId: z.string(),
	toolId: z.string(),
	/** Index for interleaving - tool appears after segment with this index */
	index: z.number(),
	name: z.string(),
	input: z.unknown(),
});
export type TurnToolStartedPayload = z.infer<
	typeof TurnToolStartedPayloadSchema
>;

export const TurnToolStartedEventSchema = z.object({
	type: z.literal("turn:tool_started"),
	payload: TurnToolStartedPayloadSchema,
});
export type TurnToolStartedEvent = z.infer<typeof TurnToolStartedEventSchema>;

// turn:tool_completed
export const TurnToolCompletedPayloadSchema = z.object({
	sessionId: z.string(),
	turnId: z.string(),
	toolId: z.string(),
	output: z.unknown(),
	success: z.boolean(),
});
export type TurnToolCompletedPayload = z.infer<
	typeof TurnToolCompletedPayloadSchema
>;

export const TurnToolCompletedEventSchema = z.object({
	type: z.literal("turn:tool_completed"),
	payload: TurnToolCompletedPayloadSchema,
});
export type TurnToolCompletedEvent = z.infer<
	typeof TurnToolCompletedEventSchema
>;

// =============================================================================
// Pulse Events
// =============================================================================

export const PulseStatusSchema = z.enum([
	"proposed",
	"running",
	"succeeded",
	"failed",
	"stopped",
]);
export type PulseStatus = z.infer<typeof PulseStatusSchema>;

// pulse:started
export const PulseStartedPayloadSchema = z.object({
	workflowId: z.string(),
	pulseId: z.string(),
	description: z.string().optional(),
	pulseBranch: z.string(),
});
export type PulseStartedPayload = z.infer<typeof PulseStartedPayloadSchema>;

export const PulseStartedEventSchema = z.object({
	type: z.literal("pulse:started"),
	payload: PulseStartedPayloadSchema,
});
export type PulseStartedEvent = z.infer<typeof PulseStartedEventSchema>;

// pulse:completed
export const PulseCompletedPayloadSchema = z.object({
	workflowId: z.string(),
	pulseId: z.string(),
	commitSha: z.string(),
	commitMessage: z.string(),
	hasUnresolvedIssues: z.boolean(),
});
export type PulseCompletedPayload = z.infer<typeof PulseCompletedPayloadSchema>;

export const PulseCompletedEventSchema = z.object({
	type: z.literal("pulse:completed"),
	payload: PulseCompletedPayloadSchema,
});
export type PulseCompletedEvent = z.infer<typeof PulseCompletedEventSchema>;

// pulse:failed
export const PulseFailedPayloadSchema = z.object({
	workflowId: z.string(),
	pulseId: z.string(),
	reason: z.string(),
	recoveryCheckpointSha: z.string().optional(),
});
export type PulseFailedPayload = z.infer<typeof PulseFailedPayloadSchema>;

export const PulseFailedEventSchema = z.object({
	type: z.literal("pulse:failed"),
	payload: PulseFailedPayloadSchema,
});
export type PulseFailedEvent = z.infer<typeof PulseFailedEventSchema>;

// =============================================================================
// Preflight Events
// =============================================================================

export const PreflightStatusSchema = z.enum(["running", "completed", "failed"]);
export type PreflightStatus = z.infer<typeof PreflightStatusSchema>;

// preflight:started
export const PreflightStartedPayloadSchema = z.object({
	workflowId: z.string(),
	worktreePath: z.string(),
});
export type PreflightStartedPayload = z.infer<
	typeof PreflightStartedPayloadSchema
>;

export const PreflightStartedEventSchema = z.object({
	type: z.literal("preflight:started"),
	payload: PreflightStartedPayloadSchema,
});
export type PreflightStartedEvent = z.infer<typeof PreflightStartedEventSchema>;

// preflight:progress
export const PreflightProgressPayloadSchema = z.object({
	workflowId: z.string(),
	message: z.string(),
	baselinesRecorded: z.number(),
});
export type PreflightProgressPayload = z.infer<
	typeof PreflightProgressPayloadSchema
>;

export const PreflightProgressEventSchema = z.object({
	type: z.literal("preflight:progress"),
	payload: PreflightProgressPayloadSchema,
});
export type PreflightProgressEvent = z.infer<
	typeof PreflightProgressEventSchema
>;

// preflight:completed
export const PreflightCompletedPayloadSchema = z.object({
	workflowId: z.string(),
	summary: z.string(),
	baselinesRecorded: z.number(),
});
export type PreflightCompletedPayload = z.infer<
	typeof PreflightCompletedPayloadSchema
>;

export const PreflightCompletedEventSchema = z.object({
	type: z.literal("preflight:completed"),
	payload: PreflightCompletedPayloadSchema,
});
export type PreflightCompletedEvent = z.infer<
	typeof PreflightCompletedEventSchema
>;

// preflight:failed
export const PreflightFailedPayloadSchema = z.object({
	workflowId: z.string(),
	error: z.string(),
});
export type PreflightFailedPayload = z.infer<
	typeof PreflightFailedPayloadSchema
>;

export const PreflightFailedEventSchema = z.object({
	type: z.literal("preflight:failed"),
	payload: PreflightFailedPayloadSchema,
});
export type PreflightFailedEvent = z.infer<typeof PreflightFailedEventSchema>;

// =============================================================================
// Question Events
// =============================================================================

import { BaseQuestionSchema } from "./questions";

// questions:asked - Agent asked questions requiring user input
export const QuestionsAskedPayloadSchema = z.object({
	sessionId: z.string(),
	turnId: z.string(),
	questions: z.array(BaseQuestionSchema),
});
export type QuestionsAskedPayload = z.infer<typeof QuestionsAskedPayloadSchema>;

export const QuestionsAskedEventSchema = z.object({
	type: z.literal("questions:asked"),
	payload: QuestionsAskedPayloadSchema,
});
export type QuestionsAskedEvent = z.infer<typeof QuestionsAskedEventSchema>;

// questions:answered - User answered a question
export const QuestionsAnsweredPayloadSchema = z.object({
	sessionId: z.string(),
	turnId: z.string(),
	questionId: z.string(),
	answer: z.unknown(),
});
export type QuestionsAnsweredPayload = z.infer<
	typeof QuestionsAnsweredPayloadSchema
>;

export const QuestionsAnsweredEventSchema = z.object({
	type: z.literal("questions:answered"),
	payload: QuestionsAnsweredPayloadSchema,
});
export type QuestionsAnsweredEvent = z.infer<
	typeof QuestionsAnsweredEventSchema
>;

// questions:submitted - User submitted all answers for a question block
export const QuestionsSubmittedPayloadSchema = z.object({
	sessionId: z.string(),
	turnId: z.string(),
	/** Optional comment/feedback provided by user */
	comment: z.string().optional(),
});
export type QuestionsSubmittedPayload = z.infer<
	typeof QuestionsSubmittedPayloadSchema
>;

export const QuestionsSubmittedEventSchema = z.object({
	type: z.literal("questions:submitted"),
	payload: QuestionsSubmittedPayloadSchema,
});
export type QuestionsSubmittedEvent = z.infer<
	typeof QuestionsSubmittedEventSchema
>;

// =============================================================================
// Shell Approval Events
// =============================================================================

// shell:approval_needed - Shell command requires user approval before execution
export const ShellApprovalNeededPayloadSchema = z.object({
	approvalId: z.string(),
	workflowId: z.string(),
	sessionId: z.string(),
	turnId: z.string(),
	toolId: z.string(),
	command: z.string(),
	reason: z.string(),
	agentRole: z.string().optional(),
});
export type ShellApprovalNeededPayload = z.infer<
	typeof ShellApprovalNeededPayloadSchema
>;

export const ShellApprovalNeededEventSchema = z.object({
	type: z.literal("shell:approval_needed"),
	payload: ShellApprovalNeededPayloadSchema,
});
export type ShellApprovalNeededEvent = z.infer<
	typeof ShellApprovalNeededEventSchema
>;

// shell:approval_resolved - User has approved or denied a shell command
export const ShellApprovalResolvedPayloadSchema = z.object({
	approvalId: z.string(),
	approved: z.boolean(),
	remember: z.boolean().optional(),
});
export type ShellApprovalResolvedPayload = z.infer<
	typeof ShellApprovalResolvedPayloadSchema
>;

export const ShellApprovalResolvedEventSchema = z.object({
	type: z.literal("shell:approval_resolved"),
	payload: ShellApprovalResolvedPayloadSchema,
});
export type ShellApprovalResolvedEvent = z.infer<
	typeof ShellApprovalResolvedEventSchema
>;

// =============================================================================
// WebSocket Event Union
// =============================================================================

export const WebSocketEventSchema = z.discriminatedUnion("type", [
	// Indexing events
	IndexingProgressEventSchema,
	// Workflow events
	WorkflowCreatedEventSchema,
	WorkflowApprovalNeededEventSchema,
	WorkflowStageChangedEventSchema,
	WorkflowCompletedEventSchema,
	WorkflowErrorEventSchema,
	// Channel events
	ChannelCreatedEventSchema,
	ChannelDeletedEventSchema,
	// Session events
	SessionStartedEventSchema,
	SessionCompletedEventSchema,
	SessionErrorEventSchema,
	// Turn events
	TurnStartedEventSchema,
	TurnCompletedEventSchema,
	// Streaming events
	TurnMessageDeltaEventSchema,
	TurnSegmentCompleteEventSchema,
	TurnThoughtDeltaEventSchema,
	// Tool events
	TurnToolStartedEventSchema,
	TurnToolCompletedEventSchema,
	// Pulse events
	PulseStartedEventSchema,
	PulseCompletedEventSchema,
	PulseFailedEventSchema,
	// Preflight events
	PreflightStartedEventSchema,
	PreflightProgressEventSchema,
	PreflightCompletedEventSchema,
	PreflightFailedEventSchema,
	// Question events
	QuestionsAskedEventSchema,
	QuestionsAnsweredEventSchema,
	QuestionsSubmittedEventSchema,
	// Shell approval events
	ShellApprovalNeededEventSchema,
	ShellApprovalResolvedEventSchema,
]);

export type WebSocketEvent = z.infer<typeof WebSocketEventSchema>;

// =============================================================================
// Helper Functions to Create Typed Events
// =============================================================================

export function createIndexingProgressEvent(
	payload: IndexingProgressPayload,
): IndexingProgressEvent {
	return { type: "indexing:progress", payload };
}

// Workflow events
export function createWorkflowCreatedEvent(
	payload: WorkflowCreatedPayload,
): WorkflowCreatedEvent {
	return { type: "workflow:created", payload };
}

export function createWorkflowApprovalNeededEvent(
	payload: WorkflowApprovalNeededPayload,
): WorkflowApprovalNeededEvent {
	return { type: "workflow:approval_needed", payload };
}

export function createWorkflowStageChangedEvent(
	payload: WorkflowStageChangedPayload,
): WorkflowStageChangedEvent {
	return { type: "workflow:stage_changed", payload };
}

export function createWorkflowCompletedEvent(
	payload: WorkflowCompletedPayload,
): WorkflowCompletedEvent {
	return { type: "workflow:completed", payload };
}

export function createWorkflowErrorEvent(
	payload: WorkflowErrorPayload,
): WorkflowErrorEvent {
	return { type: "workflow:error", payload };
}

// Channel events
export function createChannelCreatedEvent(
	payload: ChannelCreatedPayload,
): ChannelCreatedEvent {
	return { type: "channel:created", payload };
}

export function createChannelDeletedEvent(
	payload: ChannelDeletedPayload,
): ChannelDeletedEvent {
	return { type: "channel:deleted", payload };
}

// Session events
export function createSessionStartedEvent(
	payload: SessionStartedPayload,
): SessionStartedEvent {
	return { type: "session:started", payload };
}

export function createSessionCompletedEvent(
	payload: SessionCompletedPayload,
): SessionCompletedEvent {
	return { type: "session:completed", payload };
}

export function createSessionErrorEvent(
	payload: SessionErrorPayload,
): SessionErrorEvent {
	return { type: "session:error", payload };
}

// Turn events
export function createTurnStartedEvent(
	payload: TurnStartedPayload,
): TurnStartedEvent {
	return { type: "turn:started", payload };
}

export function createTurnCompletedEvent(
	payload: TurnCompletedPayload,
): TurnCompletedEvent {
	return { type: "turn:completed", payload };
}

// Streaming events
export function createTurnMessageDeltaEvent(
	payload: TurnMessageDeltaPayload,
): TurnMessageDeltaEvent {
	return { type: "turn:message_delta", payload };
}

export function createTurnSegmentCompleteEvent(
	payload: TurnSegmentCompletePayload,
): TurnSegmentCompleteEvent {
	return { type: "turn:segment_complete", payload };
}

export function createTurnThoughtDeltaEvent(
	payload: TurnThoughtDeltaPayload,
): TurnThoughtDeltaEvent {
	return { type: "turn:thought_delta", payload };
}

// Tool events
export function createTurnToolStartedEvent(
	payload: TurnToolStartedPayload,
): TurnToolStartedEvent {
	return { type: "turn:tool_started", payload };
}

export function createTurnToolCompletedEvent(
	payload: TurnToolCompletedPayload,
): TurnToolCompletedEvent {
	return { type: "turn:tool_completed", payload };
}

// Question events
export function createQuestionsAskedEvent(
	payload: QuestionsAskedPayload,
): QuestionsAskedEvent {
	return { type: "questions:asked", payload };
}

export function createQuestionsAnsweredEvent(
	payload: QuestionsAnsweredPayload,
): QuestionsAnsweredEvent {
	return { type: "questions:answered", payload };
}

export function createQuestionsSubmittedEvent(
	payload: QuestionsSubmittedPayload,
): QuestionsSubmittedEvent {
	return { type: "questions:submitted", payload };
}

// Pulse events
export function createPulseStartedEvent(
	payload: PulseStartedPayload,
): PulseStartedEvent {
	return { type: "pulse:started", payload };
}

export function createPulseCompletedEvent(
	payload: PulseCompletedPayload,
): PulseCompletedEvent {
	return { type: "pulse:completed", payload };
}

export function createPulseFailedEvent(
	payload: PulseFailedPayload,
): PulseFailedEvent {
	return { type: "pulse:failed", payload };
}

// Preflight events
export function createPreflightStartedEvent(
	payload: PreflightStartedPayload,
): PreflightStartedEvent {
	return { type: "preflight:started", payload };
}

export function createPreflightProgressEvent(
	payload: PreflightProgressPayload,
): PreflightProgressEvent {
	return { type: "preflight:progress", payload };
}

export function createPreflightCompletedEvent(
	payload: PreflightCompletedPayload,
): PreflightCompletedEvent {
	return { type: "preflight:completed", payload };
}

export function createPreflightFailedEvent(
	payload: PreflightFailedPayload,
): PreflightFailedEvent {
	return { type: "preflight:failed", payload };
}

// Shell approval events
export function createShellApprovalNeededEvent(
	payload: ShellApprovalNeededPayload,
): ShellApprovalNeededEvent {
	return { type: "shell:approval_needed", payload };
}

export function createShellApprovalResolvedEvent(
	payload: ShellApprovalResolvedPayload,
): ShellApprovalResolvedEvent {
	return { type: "shell:approval_resolved", payload };
}
