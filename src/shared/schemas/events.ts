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
	"review",
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
	delta: z.string(),
});
export type TurnMessageDeltaPayload = z.infer<
	typeof TurnMessageDeltaPayloadSchema
>;

export const TurnMessageDeltaEventSchema = z.object({
	type: z.literal("turn:message_delta"),
	payload: TurnMessageDeltaPayloadSchema,
});
export type TurnMessageDeltaEvent = z.infer<typeof TurnMessageDeltaEventSchema>;

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
	// Session events
	SessionStartedEventSchema,
	SessionCompletedEventSchema,
	SessionErrorEventSchema,
	// Turn events
	TurnStartedEventSchema,
	TurnCompletedEventSchema,
	// Streaming events
	TurnMessageDeltaEventSchema,
	TurnThoughtDeltaEventSchema,
	// Tool events
	TurnToolStartedEventSchema,
	TurnToolCompletedEventSchema,
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
