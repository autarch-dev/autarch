import { z } from "zod";
import { QuestionStatusSchema, QuestionTypeSchema } from "./questions";

// =============================================================================
// Channel Schema
// =============================================================================

/**
 * Schema for a discussion channel
 */
export const ChannelSchema = z.object({
	id: z.string(),
	name: z.string().min(1).max(50),
	description: z.string().max(500).optional(),
	createdAt: z.number(),
	updatedAt: z.number(),
});
export type Channel = z.infer<typeof ChannelSchema>;

// =============================================================================
// Request Schemas
// =============================================================================

/**
 * Schema for creating a new channel
 */
export const CreateChannelRequestSchema = z.object({
	name: z
		.string()
		.min(1, "Channel name is required")
		.max(50, "Channel name too long")
		.regex(
			/^[a-z0-9-]+$/,
			"Channel name can only contain lowercase letters, numbers, and hyphens",
		),
	description: z.string().max(500).optional(),
});
export type CreateChannelRequest = z.infer<typeof CreateChannelRequestSchema>;

// =============================================================================
// Response Schemas
// =============================================================================

/**
 * Schema for channel list response
 */
export const ChannelListResponseSchema = z.array(ChannelSchema);
export type ChannelListResponse = z.infer<typeof ChannelListResponseSchema>;

// =============================================================================
// Channel History (for page reload hydration)
// =============================================================================

/**
 * Schema for a text segment within a message.
 * Segments are created when text is interrupted by tool calls.
 */
export const MessageSegmentSchema = z.object({
	index: z.number(),
	content: z.string(),
});
export type MessageSegment = z.infer<typeof MessageSegmentSchema>;

/**
 * Schema for a question in a message (simplified for messages)
 */
export const MessageQuestionSchema = z.object({
	id: z.string(),
	questionIndex: z.number(),
	type: QuestionTypeSchema,
	prompt: z.string(),
	options: z.array(z.string()).optional(),
	answer: z.unknown().optional(),
	status: QuestionStatusSchema,
});
export type MessageQuestion = z.infer<typeof MessageQuestionSchema>;

/**
 * Schema for a message in channel history
 */
export const ChannelMessageSchema = z.object({
	id: z.string(),
	turnId: z.string(),
	role: z.enum(["user", "assistant"]),
	/**
	 * Text segments - allows text to be interleaved with tool calls.
	 * Segment N appears before tool call N.
	 */
	segments: z.array(MessageSegmentSchema),
	timestamp: z.number(),
	/** Tool calls made during this message (assistant only) */
	toolCalls: z
		.array(
			z.object({
				id: z.string(),
				/** Index for interleaving with text segments */
				index: z.number(),
				name: z.string(),
				input: z.unknown(),
				output: z.unknown().optional(),
				status: z.enum(["running", "completed", "error"]),
			}),
		)
		.optional(),
	/** Extended thinking content (assistant only, if available) */
	thought: z.string().optional(),
	/** Questions asked by the agent (assistant only) */
	questions: z.array(MessageQuestionSchema).optional(),
});
export type ChannelMessage = z.infer<typeof ChannelMessageSchema>;

/**
 * Schema for channel history response (used for page reload hydration)
 */
export const ChannelHistoryResponseSchema = z.object({
	channel: ChannelSchema,
	/** Active session ID if there's an ongoing conversation */
	sessionId: z.string().optional(),
	/** Session status */
	sessionStatus: z.enum(["active", "completed", "error"]).optional(),
	/** Messages in the channel */
	messages: z.array(ChannelMessageSchema),
});
export type ChannelHistoryResponse = z.infer<
	typeof ChannelHistoryResponseSchema
>;

// =============================================================================
// Send Message Request
// =============================================================================

/**
 * Schema for sending a message to a channel
 */
export const SendChannelMessageRequestSchema = z.object({
	content: z.string().min(1, "Message cannot be empty"),
});
export type SendChannelMessageRequest = z.infer<
	typeof SendChannelMessageRequestSchema
>;
