import { z } from "zod";

// =============================================================================
// Roadmap Status and Enums
// =============================================================================

export const RoadmapStatusSchema = z.enum([
	"draft",
	"active",
	"completed",
	"archived",
	"error",
]);
export type RoadmapStatus = z.infer<typeof RoadmapStatusSchema>;

export const InitiativeStatusSchema = z.enum([
	"not_started",
	"in_progress",
	"completed",
	"blocked",
]);
export type InitiativeStatus = z.infer<typeof InitiativeStatusSchema>;

export const InitiativePrioritySchema = z.enum([
	"low",
	"medium",
	"high",
	"critical",
]);
export type InitiativePriority = z.infer<typeof InitiativePrioritySchema>;

export const InitiativeSizes = [1, 2, 3, 5, 8, 13, 21] as const;
export const InitiativeSizeSchema = z.union(
	InitiativeSizes.map((v) => z.literal(v)),
);
export type InitiativeSize = z.infer<typeof InitiativeSizeSchema>;

export const RoadmapPerspectiveSchema = z.enum([
	"balanced",
	"visionary",
	"iterative",
	"tech_lead",
	"pathfinder",
]);
export type RoadmapPerspective = z.infer<typeof RoadmapPerspectiveSchema>;

// =============================================================================
// Roadmap
// =============================================================================

export const RoadmapSchema = z.object({
	id: z.string(),
	title: z.string(),
	description: z.string().optional(),
	status: RoadmapStatusSchema,
	perspective: RoadmapPerspectiveSchema,
	currentSessionId: z.string().optional(),
	createdAt: z.number(),
	updatedAt: z.number(),
});
export type Roadmap = z.infer<typeof RoadmapSchema>;

// =============================================================================
// Milestone
// =============================================================================

export const MilestoneSchema = z.object({
	id: z.string(),
	roadmapId: z.string(),
	title: z.string(),
	description: z.string().optional(),
	sortOrder: z.number(),
	createdAt: z.number(),
	updatedAt: z.number(),
});
export type Milestone = z.infer<typeof MilestoneSchema>;

// =============================================================================
// Initiative
// =============================================================================

export const InitiativeSchema = z.object({
	id: z.string(),
	milestoneId: z.string(),
	roadmapId: z.string(),
	title: z.string(),
	description: z.string().optional(),
	status: InitiativeStatusSchema,
	priority: InitiativePrioritySchema,
	progress: z.number().min(0).max(100),
	workflowId: z.string().optional(),
	size: InitiativeSizeSchema.nullable().optional(),
	sortOrder: z.number(),
	createdAt: z.number(),
	updatedAt: z.number(),
});
export type Initiative = z.infer<typeof InitiativeSchema>;

// =============================================================================
// Vision Document
// =============================================================================

export const VisionDocumentSchema = z.object({
	id: z.string(),
	roadmapId: z.string(),
	content: z.string(),
	createdAt: z.number(),
	updatedAt: z.number(),
});
export type VisionDocument = z.infer<typeof VisionDocumentSchema>;

// =============================================================================
// Roadmap Dependency
// =============================================================================

export const RoadmapDependencyNodeTypeSchema = z.enum([
	"milestone",
	"initiative",
]);
export type RoadmapDependencyNodeType = z.infer<
	typeof RoadmapDependencyNodeTypeSchema
>;

export const RoadmapDependencySchema = z.object({
	id: z.string(),
	sourceType: RoadmapDependencyNodeTypeSchema,
	sourceId: z.string(),
	targetType: RoadmapDependencyNodeTypeSchema,
	targetId: z.string(),
	createdAt: z.number(),
});
export type RoadmapDependency = z.infer<typeof RoadmapDependencySchema>;
