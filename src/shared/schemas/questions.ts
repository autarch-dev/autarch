import { z } from "zod";

// =============================================================================
// Question Types
// =============================================================================

export const QuestionTypeSchema = z.enum([
	"single_select",
	"multi_select",
	"ranked",
	"free_text",
]);
export type QuestionType = z.infer<typeof QuestionTypeSchema>;

export const QuestionStatusSchema = z.enum(["pending", "answered", "skipped"]);
export type QuestionStatus = z.infer<typeof QuestionStatusSchema>;

// =============================================================================
// Question Input Schema (for tool input - no id, status, or timestamps)
// =============================================================================

/**
 * Schema for question input when asking questions via tool
 */
export const QuestionInputSchema = z.object({
	type: QuestionTypeSchema,
	prompt: z.string(),
	options: z.array(z.string()).optional(),
});
export type QuestionInput = z.infer<typeof QuestionInputSchema>;

// =============================================================================
// Base Question Schema (core fields shared across contexts)
// =============================================================================

/**
 * Base question fields used in events and messages
 */
export const BaseQuestionSchema = z.object({
	id: z.string(),
	questionIndex: z.number(),
	type: QuestionTypeSchema,
	prompt: z.string(),
	options: z.array(z.string()).optional(),
});
export type BaseQuestion = z.infer<typeof BaseQuestionSchema>;

// =============================================================================
// Question Schema (for display/history - extends base with answer/status)
// =============================================================================

/**
 * A question asked by the agent with full state
 */
export const QuestionSchema = BaseQuestionSchema.extend({
	answer: z.unknown().optional(), // string for single_select/free_text, string[] for multi_select/ranked
	status: QuestionStatusSchema,
	createdAt: z.number(),
	answeredAt: z.number().optional(),
});
export type Question = z.infer<typeof QuestionSchema>;

// =============================================================================
// Request Schemas
// =============================================================================

/**
 * Request to answer a question
 */
export const AnswerQuestionRequestSchema = z.object({
	answer: z.unknown(), // Validated based on question type
});
export type AnswerQuestionRequest = z.infer<typeof AnswerQuestionRequestSchema>;

/**
 * Request to answer multiple questions at once
 */
export const AnswerQuestionsRequestSchema = z.object({
	answers: z.array(
		z.object({
			questionId: z.string(),
			answer: z.unknown(),
		}),
	),
	/** Optional question IDs for session resolution when answers array is empty */
	questionIds: z.array(z.string()).optional(),
	/** Optional additional comment/feedback from the user */
	comment: z.string().optional(),
});
export type AnswerQuestionsRequest = z.infer<
	typeof AnswerQuestionsRequestSchema
>;

// =============================================================================
// Response Schemas
// =============================================================================

/**
 * Response after answering questions
 */
export const AnswerQuestionsResponseSchema = z.object({
	success: z.boolean(),
	answeredCount: z.number(),
	allAnswered: z.boolean(),
	/** If all questions were answered, the session may have been resumed */
	sessionResumed: z.boolean().optional(),
});
export type AnswerQuestionsResponse = z.infer<
	typeof AnswerQuestionsResponseSchema
>;
