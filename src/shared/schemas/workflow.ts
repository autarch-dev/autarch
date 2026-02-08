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

export const WORKFLOW_STATUS_COLORS: Record<WorkflowStatus, string> = {
	backlog: "text-muted-foreground bg-muted",
	scoping:
		"text-purple-700 bg-purple-100 dark:text-purple-400 dark:bg-purple-950",
	researching: "text-blue-700 bg-blue-100 dark:text-blue-400 dark:bg-blue-950",
	planning: "text-cyan-700 bg-cyan-100 dark:text-cyan-400 dark:bg-cyan-950",
	in_progress:
		"text-yellow-700 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-950",
	review:
		"text-orange-700 bg-orange-100 dark:text-orange-400 dark:bg-orange-950",
	done: "text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-950",
};

export const WORKFLOW_STATUS_LABELS: Record<WorkflowStatus, string> = {
	backlog: "Backlog",
	scoping: "Scoping",
	researching: "Researching",
	planning: "Planning",
	in_progress: "In Progress",
	review: "Review",
	done: "Done",
};

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

/** Workflow path type for reuse across frontend/backend */
export const WorkflowPathSchema = z.enum(["quick", "full"]);
export type WorkflowPath = z.infer<typeof WorkflowPathSchema>;

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
	/** Persisted diff content - captured at approval time before branch deletion */
	diffContent: z.string().optional(),
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
	/** Stages that were skipped (e.g., 'researching', 'planning' for quick path) */
	skippedStages: z.array(z.string()).optional(),
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
// Pulse (execution unit)
// =============================================================================

export const PulseSchema = z.object({
	id: z.string(),
	workflowId: z.string(),
	plannedPulseId: z.string(),
	status: z.enum(["proposed", "running", "succeeded", "failed", "stopped"]),
	description: z.string(),
	hasUnresolvedIssues: z.boolean(),
	createdAt: z.number(),
	startedAt: z.number().optional(),
	completedAt: z.number().optional(),
});
export type Pulse = z.infer<typeof PulseSchema>;

// =============================================================================
// Preflight Setup
// =============================================================================

export const VerificationCommandSchema = z.object({
	command: z.string(),
	source: z.enum(["build", "lint", "test"]),
});
export type VerificationCommand = z.infer<typeof VerificationCommandSchema>;

export const PreflightSetupSchema = z.object({
	id: z.string(),
	workflowId: z.string(),
	sessionId: z.string(),
	status: z.enum(["running", "completed", "failed"]),
	progressMessage: z.string().optional(),
	errorMessage: z.string().optional(),
	verificationCommands: z.array(VerificationCommandSchema),
	createdAt: z.number(),
	startedAt: z.number().optional(),
	completedAt: z.number().optional(),
});
export type PreflightSetup = z.infer<typeof PreflightSetupSchema>;

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
	/** All pulses for this workflow (execution units) */
	pulses: z.array(PulseSchema).optional(),
	/** Preflight setup for this workflow (if in execution stage) */
	preflightSetup: PreflightSetupSchema.optional(),
});
export type WorkflowHistoryResponse = z.infer<
	typeof WorkflowHistoryResponseSchema
>;
