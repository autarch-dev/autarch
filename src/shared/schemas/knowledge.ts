import { z } from "zod";

// =============================================================================
// Categories
// =============================================================================

export const KnowledgeCategorySchema = z.enum([
	"pattern",
	"gotcha",
	"tool-usage",
	"process-improvement",
]);
export type KnowledgeCategory = z.infer<typeof KnowledgeCategorySchema>;

// =============================================================================
// Item
// =============================================================================

export const KnowledgeItemSchema = z.object({
	id: z.string(),
	workflowId: z.string(),
	cardId: z.string().nullable(),
	sessionId: z.string().nullable(),
	turnId: z.string().nullable(),
	title: z.string(),
	content: z.string(),
	category: KnowledgeCategorySchema,
	tags: z.array(z.string()),
	archived: z.boolean(),
	createdAt: z.number(),
	updatedAt: z.number(),
});
export type KnowledgeItem = z.infer<typeof KnowledgeItemSchema>;

// =============================================================================
// Filters
// =============================================================================

export const KnowledgeListFiltersSchema = z.object({
	category: KnowledgeCategorySchema.optional(),
	workflowId: z.string().optional(),
	tags: z.string().optional(),
	startDate: z.coerce.number().optional(),
	endDate: z.coerce.number().optional(),
	archived: z
		.string()
		.transform((val) => val === "true")
		.optional(),
	offset: z.coerce.number().int().min(0).default(0),
	limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type KnowledgeListFilters = z.infer<typeof KnowledgeListFiltersSchema>;

export const KnowledgeSearchFiltersSchema = z.object({
	query: z.string().min(1),
	category: KnowledgeCategorySchema.optional(),
	workflowId: z.string().optional(),
	tags: z.string().optional(),
	startDate: z.coerce.number().optional(),
	endDate: z.coerce.number().optional(),
	archived: z
		.string()
		.transform((val) => val === "true")
		.optional(),
	limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type KnowledgeSearchFilters = z.infer<
	typeof KnowledgeSearchFiltersSchema
>;

// =============================================================================
// Mutations
// =============================================================================

export const UpdateKnowledgeItemSchema = z
	.object({
		title: z.string().min(1).optional(),
		content: z.string().min(1).optional(),
		category: KnowledgeCategorySchema.optional(),
		tags: z.array(z.string()).optional(),
	})
	.refine(
		(data) =>
			data.title !== undefined ||
			data.content !== undefined ||
			data.category !== undefined ||
			data.tags !== undefined,
		{ message: "At least one field must be provided" },
	);
export type UpdateKnowledgeItem = z.infer<typeof UpdateKnowledgeItemSchema>;

export const ArchiveKnowledgeItemSchema = z.object({
	archived: z.boolean(),
});
export type ArchiveKnowledgeItem = z.infer<typeof ArchiveKnowledgeItemSchema>;

// =============================================================================
// Responses
// =============================================================================

export const KnowledgeListResponseSchema = z.object({
	items: z.array(KnowledgeItemSchema),
	total: z.number(),
});
export type KnowledgeListResponse = z.infer<typeof KnowledgeListResponseSchema>;

export const KnowledgeSearchResponseSchema = z.object({
	results: z.array(KnowledgeItemSchema.extend({ score: z.number() })),
});
export type KnowledgeSearchResponse = z.infer<
	typeof KnowledgeSearchResponseSchema
>;
