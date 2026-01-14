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

// =============================================================================
// WebSocket Event Union
// =============================================================================

export const IndexingProgressEventSchema = z.object({
	type: z.literal("indexing:progress"),
	payload: IndexingProgressPayloadSchema,
});

// Add more event types here as needed, then add to the union below
export const WebSocketEventSchema = z.discriminatedUnion("type", [
	IndexingProgressEventSchema,
]);

export type WebSocketEvent = z.infer<typeof WebSocketEventSchema>;
export type IndexingProgressEvent = z.infer<typeof IndexingProgressEventSchema>;

// =============================================================================
// Helper to create typed events
// =============================================================================

export function createIndexingProgressEvent(
	payload: IndexingProgressPayload,
): IndexingProgressEvent {
	return { type: "indexing:progress", payload };
}
