import { z } from "zod";
import { ChannelMessageSchema } from "./channel";

// =============================================================================
// Workflow Status and Priority
// =============================================================================

export const WorkflowStatusSchema = z.enum([
	"backlog",
	"scoping",
	"researching",
	"planning",
	"in_progress",
	"review",
	"done",
]);
export type WorkflowStatus = z.infer<typeof WorkflowStatusSchema>;

export const WorkflowPrioritySchema = z.enum([
	"low",
	"medium",
	"high",
	"urgent",
]);
export type WorkflowPriority = z.infer<typeof WorkflowPrioritySchema>;

// =============================================================================
// Artifact Status (shared across scope cards, research cards, plans)
// =============================================================================

export const ArtifactStatusSchema = z.enum(["pending", "approved", "denied"]);
export type ArtifactStatus = z.infer<typeof ArtifactStatusSchema>;

// =============================================================================
// Rewind Target
// =============================================================================

export const RewindTargetSchema = z.enum([
	"researching",
	"planning",
	"in_progress",
	"review",
]);
export type RewindTarget = z.infer<typeof RewindTargetSchema>;

// =============================================================================
// Scope Card
// =============================================================================

export const RecommendedPathSchema = z.enum(["quick", "full"]);
export type RecommendedPath = z.infer<typeof RecommendedPathSchema>;

export const ScopeCardSchema = z.object({
	id: z.string(),
	workflowId: z.string(),
	/** Turn ID this artifact was created in (for timeline ordering) */
	turnId: z.string().optional(),
	title: z.string(),
	description: z.string(),
	inScope: z.array(z.string()),
	outOfScope: z.array(z.string()),
	constraints: z.array(z.string()).optional(),
	recommendedPath: RecommendedPathSchema,
	rationale: z.string().optional(),
	status: ArtifactStatusSchema,
	createdAt: z.number(),
});
export type ScopeCard = z.infer<typeof ScopeCardSchema>;

// =============================================================================
// Research Card
// =============================================================================

export const KeyFileSchema = z.object({
	path: z.string(),
	purpose: z.string(),
	lineRanges: z.string().optional(),
});
export type KeyFile = z.infer<typeof KeyFileSchema>;

export const PatternSchema = z.object({
	category: z.string(),
	description: z.string(),
	example: z.string(),
	locations: z.array(z.string()),
});
export type Pattern = z.infer<typeof PatternSchema>;

export const DependencySchema = z.object({
	name: z.string(),
	purpose: z.string(),
	usageExample: z.string(),
});
export type Dependency = z.infer<typeof DependencySchema>;

export const IntegrationPointSchema = z.object({
	location: z.string(),
	description: z.string(),
	existingCode: z.string(),
});
export type IntegrationPoint = z.infer<typeof IntegrationPointSchema>;

export const ChallengeSchema = z.object({
	issue: z.string(),
	mitigation: z.string(),
});
export type Challenge = z.infer<typeof ChallengeSchema>;

export const ResearchCardSchema = z.object({
	id: z.string(),
	workflowId: z.string(),
	/** Turn ID this artifact was created in (for timeline ordering) */
	turnId: z.string().optional(),
	summary: z.string(),
	keyFiles: z.array(KeyFileSchema),
	patterns: z.array(PatternSchema).optional(),
	dependencies: z.array(DependencySchema).optional(),
	integrationPoints: z.array(IntegrationPointSchema).optional(),
	challenges: z.array(ChallengeSchema).optional(),
	recommendations: z.array(z.string()),
	status: ArtifactStatusSchema,
	createdAt: z.number(),
});
export type ResearchCard = z.infer<typeof ResearchCardSchema>;

// =============================================================================
// Plan
// =============================================================================

export const PulseSizeSchema = z.enum(["small", "medium", "large"]);
export type PulseSize = z.infer<typeof PulseSizeSchema>;

export const PulseDefinitionSchema = z.object({
	id: z.string(),
	title: z.string(),
	description: z.string(),
	expectedChanges: z.array(z.string()),
	estimatedSize: PulseSizeSchema,
	dependsOn: z.array(z.string()).optional(),
});
export type PulseDefinition = z.infer<typeof PulseDefinitionSchema>;

export const PlanSchema = z.object({
	id: z.string(),
	workflowId: z.string(),
	/** Turn ID this artifact was created in (for timeline ordering) */
	turnId: z.string().optional(),
	approachSummary: z.string(),
	pulses: z.array(PulseDefinitionSchema),
	status: ArtifactStatusSchema,
	createdAt: z.number(),
});
export type Plan = z.infer<typeof PlanSchema>;

// =============================================================================
// Review Card
// =============================================================================

export const ReviewRecommendationSchema = z.enum([
	"approve",
	"deny",
	"manual_review",
]);
export type ReviewRecommendation = z.infer<typeof ReviewRecommendationSchema>;

export const ReviewCommentTypeSchema = z.enum(["line", "file", "review"]);
export type ReviewCommentType = z.infer<typeof ReviewCommentTypeSchema>;

export const ReviewCommentSeveritySchema = z.enum(["High", "Medium", "Low"]);
export type ReviewCommentSeverity = z.infer<typeof ReviewCommentSeveritySchema>;

export const ReviewCommentAuthorSchema = z.enum(["agent", "user"]);
export type ReviewCommentAuthor = z.infer<typeof ReviewCommentAuthorSchema>;

export const ReviewCommentSchema = z.object({
	id: z.string(),
	reviewCardId: z.string(),
	/** Type of comment: line (attached to lines), file (file-level), review (general) */
	type: ReviewCommentTypeSchema,
	/** File path - required for line/file comments, undefined for review-level */
	filePath: z.string().optional(),
	/** Starting line number - required for line comments */
	startLine: z.number().optional(),
	/** Ending line number - optional, for multi-line comments */
	endLine: z.number().optional(),
	/** Severity: High, Medium, Low - optional for user comments */
	severity: z.optional(ReviewCommentSeveritySchema),
	/** Category (e.g., security, performance, style, bug, architecture) - optional for user comments */
	category: z.optional(z.string()),
	/** The comment description/content */
	description: z.string(),
	/** Author of the comment: agent or user */
	author: ReviewCommentAuthorSchema.default("agent"),
	createdAt: z.number(),
});
export type ReviewComment = z.infer<typeof ReviewCommentSchema>;

export const ReviewCardSchema = z.object({
	id: z.string(),
	workflowId: z.string(),
	/** Turn ID this artifact was created in (for timeline ordering) */
	turnId: z.string().optional(),
	/** Recommendation from review agent - undefined until completeReview is called */
	recommendation: ReviewRecommendationSchema.optional(),
	/** Summary from review agent - undefined until completeReview is called */
	summary: z.string().optional(),
	/** Suggested commit message from review agent - undefined until completeReview is called */
	suggestedCommitMessage: z.string().optional(),
	/** Comments added during review */
	comments: z.array(ReviewCommentSchema),
	status: ArtifactStatusSchema,
	createdAt: z.number(),
});
export type ReviewCard = z.infer<typeof ReviewCardSchema>;

// =============================================================================
// Merge Strategy
// =============================================================================

export const MergeStrategySchema = z.enum([
	"fast-forward",
	"squash",
	"merge-commit",
	"rebase",
]);
export type MergeStrategy = z.infer<typeof MergeStrategySchema>;

// =============================================================================
// Workflow
// =============================================================================

export const WorkflowSchema = z.object({
	id: z.string(),
	title: z.string(),
	description: z.string().optional(),
	status: WorkflowStatusSchema,
	priority: WorkflowPrioritySchema,
	currentSessionId: z.string().optional(),
	awaitingApproval: z.boolean(),
	archived: z.boolean().default(false),
	pendingArtifactType: z
		.enum(["scope_card", "research", "plan", "review_card"])
		.optional(),
	/** The branch the workflow was created from (for diff calculation) */
	baseBranch: z.string().optional(),
	createdAt: z.number(),
	updatedAt: z.number(),
});
export type Workflow = z.infer<typeof WorkflowSchema>;

// =============================================================================
// Stage Transition Helpers
// =============================================================================

/** Maps workflow status to the next status in the pipeline */
export const STAGE_TRANSITIONS: Record<WorkflowStatus, WorkflowStatus | null> =
	{
		backlog: "scoping",
		scoping: "researching",
		researching: "planning",
		planning: "in_progress",
		in_progress: "review",
		review: "done",
		done: null,
	};

/** Tools that require user approval before transitioning */
export const APPROVAL_REQUIRED_TOOLS: Record<string, WorkflowStatus> = {
	submit_scope: "researching",
	submit_research: "planning",
	submit_plan: "in_progress",
	complete_review: "done",
};

/** Tools that trigger automatic transitions (no approval needed) */
export const AUTO_TRANSITION_TOOLS: Record<string, WorkflowStatus> = {
	complete_pulse: "review",
};

/** Get the next stage after the current one */
export function getNextStage(
	currentStage: WorkflowStatus,
): WorkflowStatus | null {
	return STAGE_TRANSITIONS[currentStage];
}

// =============================================================================
// Workflow History Response
// =============================================================================

/**
 * Schema for workflow history response (used for page reload hydration)
 */
export const WorkflowHistoryResponseSchema = z.object({
	workflow: WorkflowSchema,
	/** Active session ID if there's an ongoing conversation */
	sessionId: z.string().optional(),
	/** Session status */
	sessionStatus: z.enum(["active", "completed", "error"]).optional(),
	/** Messages in the workflow conversation */
	messages: z.array(ChannelMessageSchema),
	/** All scope cards for this workflow (includes pending, approved, denied) */
	scopeCards: z.array(ScopeCardSchema),
	/** All research cards for this workflow */
	researchCards: z.array(ResearchCardSchema),
	/** All plans for this workflow */
	plans: z.array(PlanSchema),
	/** All review cards for this workflow */
	reviewCards: z.array(ReviewCardSchema),
});
export type WorkflowHistoryResponse = z.infer<
	typeof WorkflowHistoryResponseSchema
>;
