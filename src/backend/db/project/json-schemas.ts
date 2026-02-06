/**
 * Zod schemas for JSON fields stored in SQLite
 *
 * All JSON data stored in the database MUST be validated on read and write
 * using these schemas. Never use raw JSON.parse/stringify.
 */

import { z } from "zod";

// =============================================================================
// Scope Cards
// =============================================================================

/** Schema for scope card in_scope_json / out_of_scope_json / constraints_json */
export const ScopeListSchema = z.array(z.string());
export type ScopeList = z.infer<typeof ScopeListSchema>;

// =============================================================================
// Research Cards
// =============================================================================

export const KeyFileJsonSchema = z.object({
	path: z.string(),
	purpose: z.string(),
	lineRanges: z.string().optional(),
});
export type KeyFileJson = z.infer<typeof KeyFileJsonSchema>;

export const PatternJsonSchema = z.object({
	category: z.string(),
	description: z.string(),
	example: z.string(),
	locations: z.array(z.string()),
});
export type PatternJson = z.infer<typeof PatternJsonSchema>;

export const DependencyJsonSchema = z.object({
	name: z.string(),
	purpose: z.string(),
	usageExample: z.string(),
});
export type DependencyJson = z.infer<typeof DependencyJsonSchema>;

export const IntegrationPointJsonSchema = z.object({
	location: z.string(),
	description: z.string(),
	existingCode: z.string(),
});
export type IntegrationPointJson = z.infer<typeof IntegrationPointJsonSchema>;

export const ChallengeJsonSchema = z.object({
	issue: z.string(),
	mitigation: z.string(),
});
export type ChallengeJson = z.infer<typeof ChallengeJsonSchema>;

export const KeyFilesJsonSchema = z.array(KeyFileJsonSchema);
export const PatternsJsonSchema = z.array(PatternJsonSchema);
export const DependenciesJsonSchema = z.array(DependencyJsonSchema);
export const IntegrationPointsJsonSchema = z.array(IntegrationPointJsonSchema);
export const ChallengesJsonSchema = z.array(ChallengeJsonSchema);
export const RecommendationsJsonSchema = z.array(z.string());

// =============================================================================
// Plans
// =============================================================================

export const PulseJsonSchema = z.object({
	id: z.string(),
	title: z.string(),
	description: z.string(),
	expectedChanges: z.array(z.string()),
	estimatedSize: z.enum(["small", "medium", "large"]),
	dependsOn: z.array(z.string()).optional(),
});
export type PulseJson = z.infer<typeof PulseJsonSchema>;

export const PulsesJsonSchema = z.array(PulseJsonSchema);

// =============================================================================
// Review Comments
// =============================================================================

export const ReviewCommentJsonSchema = z.object({
	id: z.string(),
	reviewCardId: z.string(),
	/** Type of comment: line (attached to lines), file (file-level), review (general) */
	type: z.enum(["line", "file", "review"]),
	/** File path - required for line/file comments, undefined for review-level */
	filePath: z.string().optional(),
	/** Starting line number - required for line comments */
	startLine: z.number().optional(),
	/** Ending line number - optional, for multi-line comments */
	endLine: z.number().optional(),
	/** Severity: High, Medium, Low */
	severity: z.enum(["High", "Medium", "Low"]),
	/** Category (e.g., security, performance, style, bug, architecture) */
	category: z.string(),
	/** The comment description/content */
	description: z.string(),
	createdAt: z.number(),
});
export type ReviewCommentJson = z.infer<typeof ReviewCommentJsonSchema>;

export const ReviewCommentsJsonSchema = z.array(ReviewCommentJsonSchema);

// =============================================================================
// Tool Calls
// =============================================================================

/**
 * Tool input can be any JSON-serializable object.
 * The actual shape is validated by the tool's inputSchema at runtime.
 */
export const ToolInputJsonSchema = z.record(z.string(), z.unknown());

/**
 * Tool output is plain text.
 * The AI SDK receives the formatted string output from tools.
 */
export const ToolOutputJsonSchema = z.string();

// =============================================================================
// Questions
// =============================================================================

export const QuestionOptionsJsonSchema = z.array(z.string());
export const QuestionAnswerJsonSchema = z.unknown(); // Can be string, string[], or other

// =============================================================================
// Safe JSON Utilities
// =============================================================================

/**
 * Safely parse JSON from database with schema validation.
 * Throws descriptive error if parsing or validation fails.
 */
export function parseJson<T extends z.ZodTypeAny>(
	json: string | null,
	schema: T,
	fieldName: string,
): z.infer<T> {
	if (json === null) {
		throw new Error(`${fieldName}: Expected JSON string but got null`);
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(json);
	} catch (e) {
		throw new Error(
			`${fieldName}: Invalid JSON - ${e instanceof Error ? e.message : "parse error"}`,
		);
	}

	const result = schema.safeParse(parsed);
	if (!result.success) {
		throw new Error(
			`${fieldName}: Schema validation failed - ${result.error.message}`,
		);
	}

	return result.data;
}

/**
 * Safely parse optional JSON from database with schema validation.
 * Returns undefined if json is null, throws on parse/validation error.
 */
export function parseJsonOptional<T extends z.ZodTypeAny>(
	json: string | null,
	schema: T,
	fieldName: string,
): z.infer<T> | undefined {
	if (json === null) {
		return undefined;
	}
	return parseJson(json, schema, fieldName);
}

/**
 * Safely stringify data to JSON with schema validation.
 * Validates data matches schema before serializing.
 * Accepts unknown and validates via Zod - that's the whole point.
 */
export function stringifyJson<T extends z.ZodTypeAny>(
	data: unknown,
	schema: T,
	fieldName: string,
): string {
	if (typeof data === "string") {
		return JSON.stringify(data);
	}

	const result = schema.safeParse(data);

	if (!result.success) {
		throw new Error(
			`${fieldName}: Schema validation failed before stringify - ${result.error.message}`,
			{
				cause: data,
			},
		);
	}

	return JSON.stringify(result.data);
}

/**
 * Safely stringify optional data to JSON with schema validation.
 * Returns null if data is undefined/null.
 */
export function stringifyJsonOptional<T extends z.ZodTypeAny>(
	data: unknown,
	schema: T,
	fieldName: string,
): string | null {
	if (data === undefined || data === null) {
		return null;
	}
	return stringifyJson(data, schema, fieldName);
}
