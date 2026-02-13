/**
 * Knowledge API Routes
 *
 * Routes for managing knowledge items.
 * Uses KnowledgeRepository for data access and searchKnowledge for semantic search.
 */

import { z } from "zod";
import { getKnowledgeDb } from "@/backend/db/knowledge";
import type { KnowledgeCategory } from "@/backend/db/knowledge/types";
import { KnowledgeRepository } from "@/backend/services/knowledge/repository";
import {
	type SearchFilters,
	searchKnowledge,
} from "@/backend/services/knowledge/search";
import { log } from "../logger";
import { getProjectRoot } from "../projectRoot";

// =============================================================================
// Schemas
// =============================================================================

const KNOWLEDGE_CATEGORIES = [
	"pattern",
	"gotcha",
	"tool-usage",
	"process-improvement",
] as const;

const IdParamSchema = z.object({
	id: z.string().min(1),
});

const CreateKnowledgeItemSchema = z.object({
	workflowId: z.string().min(1),
	cardId: z.string().nullable().optional(),
	sessionId: z.string().nullable().optional(),
	turnId: z.string().nullable().optional(),
	title: z.string().min(1),
	content: z.string().min(1),
	category: z.enum(KNOWLEDGE_CATEGORIES),
	tags: z.array(z.string()).optional().default([]),
});

const UpdateKnowledgeItemSchema = z
	.object({
		title: z.string().min(1).optional(),
		content: z.string().min(1).optional(),
		category: z.enum(KNOWLEDGE_CATEGORIES).optional(),
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

const ListQuerySchema = z.object({
	category: z.enum(KNOWLEDGE_CATEGORIES).optional(),
	tags: z.string().optional(),
	startDate: z.coerce.number().optional(),
	endDate: z.coerce.number().optional(),
	offset: z.coerce.number().int().min(0).optional().default(0),
	limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

const SearchQuerySchema = z.object({
	query: z.string().min(1),
	category: z.enum(KNOWLEDGE_CATEGORIES).optional(),
	tags: z.string().optional(),
	startDate: z.coerce.number().optional(),
	endDate: z.coerce.number().optional(),
	limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

// =============================================================================
// Helpers
// =============================================================================

/**
 * Parse and validate route params with Zod.
 */
function parseParams<T extends z.ZodTypeAny>(
	// biome-ignore lint/suspicious/noExplicitAny: Bun adds params to Request
	req: Request & { params?: any },
	schema: T,
): z.infer<T> | null {
	const result = schema.safeParse(req.params);
	if (!result.success) {
		return null;
	}
	return result.data;
}

/**
 * Get a KnowledgeRepository instance for the current project.
 */
async function getKnowledgeRepo(): Promise<KnowledgeRepository> {
	const projectRoot = getProjectRoot();
	const db = await getKnowledgeDb(projectRoot);
	return new KnowledgeRepository(db);
}

// =============================================================================
// Routes
// =============================================================================

export const knowledgeRoutes = {
	"/api/knowledge": {
		async GET(req: Request) {
			try {
				const searchParams = new URL(req.url).searchParams;
				const rawQuery: Record<string, string> = {};

				for (const key of [
					"category",
					"tags",
					"startDate",
					"endDate",
					"offset",
					"limit",
				]) {
					const value = searchParams.get(key);
					if (value !== null) {
						rawQuery[key] = value;
					}
				}

				const result = ListQuerySchema.safeParse(rawQuery);
				if (!result.success) {
					return Response.json(
						{
							error: "Invalid query parameters",
							details: z.prettifyError(result.error),
						},
						{ status: 400 },
					);
				}

				const data = result.data;
				const repo = await getKnowledgeRepo();

				const filters: {
					category?: KnowledgeCategory;
					tags?: string[];
					startDate?: number;
					endDate?: number;
					offset?: number;
					limit?: number;
				} = {
					offset: data.offset,
					limit: data.limit,
				};

				if (data.category !== undefined) {
					filters.category = data.category;
				}
				if (data.tags !== undefined) {
					filters.tags = data.tags.split(",").map((t) => t.trim());
				}
				if (data.startDate !== undefined) {
					filters.startDate = data.startDate;
				}
				if (data.endDate !== undefined) {
					filters.endDate = data.endDate;
				}

				const [items, total] = await Promise.all([
					repo.search(filters),
					repo.count(filters),
				]);
				return Response.json({ items, total });
			} catch (error) {
				log.api.error("Failed to list knowledge items:", error);
				return Response.json(
					{
						error: error instanceof Error ? error.message : "Unknown error",
					},
					{ status: 500 },
				);
			}
		},

		async POST(req: Request) {
			try {
				const body = await req.json();
				const parsed = CreateKnowledgeItemSchema.safeParse(body);
				if (!parsed.success) {
					return Response.json(
						{
							error: "Invalid request body",
							details: z.prettifyError(parsed.error),
						},
						{ status: 400 },
					);
				}

				const repo = await getKnowledgeRepo();
				const id = await repo.create(parsed.data);
				const item = await repo.getById(id);

				return Response.json(item, { status: 201 });
			} catch (error) {
				log.api.error("Failed to create knowledge item:", error);
				return Response.json(
					{
						error: error instanceof Error ? error.message : "Unknown error",
					},
					{ status: 500 },
				);
			}
		},
	},

	"/api/knowledge/search": {
		async GET(req: Request) {
			try {
				const searchParams = new URL(req.url).searchParams;
				const rawQuery: Record<string, string> = {};

				for (const key of [
					"query",
					"category",
					"tags",
					"startDate",
					"endDate",
					"limit",
				]) {
					const value = searchParams.get(key);
					if (value !== null) {
						rawQuery[key] = value;
					}
				}

				const result = SearchQuerySchema.safeParse(rawQuery);
				if (!result.success) {
					return Response.json(
						{
							error: "Invalid query parameters",
							details: z.prettifyError(result.error),
						},
						{ status: 400 },
					);
				}

				const data = result.data;
				const projectRoot = getProjectRoot();

				const filters: SearchFilters = {
					limit: data.limit,
				};

				if (data.category !== undefined) {
					filters.category = data.category;
				}
				if (data.tags !== undefined) {
					filters.tags = data.tags.split(",").map((t) => t.trim());
				}
				if (data.startDate !== undefined) {
					filters.startDate = data.startDate;
				}
				if (data.endDate !== undefined) {
					filters.endDate = data.endDate;
				}

				const results = await searchKnowledge(data.query, filters, projectRoot);
				return Response.json({ results });
			} catch (error) {
				log.api.error("Failed to search knowledge:", error);
				return Response.json(
					{
						error: error instanceof Error ? error.message : "Unknown error",
					},
					{ status: 500 },
				);
			}
		},
	},

	"/api/knowledge/:id": {
		async DELETE(req: Request) {
			const params = parseParams(req, IdParamSchema);
			if (!params) {
				return Response.json(
					{ error: "Invalid or missing id parameter" },
					{ status: 400 },
				);
			}
			try {
				const repo = await getKnowledgeRepo();
				const deleted = await repo.delete(params.id);
				if (!deleted) {
					return Response.json(
						{ error: "Knowledge item not found" },
						{ status: 404 },
					);
				}
				return new Response(null, { status: 204 });
			} catch (error) {
				log.api.error("Failed to delete knowledge item:", error);
				return Response.json(
					{
						error: error instanceof Error ? error.message : "Unknown error",
					},
					{ status: 500 },
				);
			}
		},

		async PATCH(req: Request) {
			const params = parseParams(req, IdParamSchema);
			if (!params) {
				return Response.json(
					{ error: "Invalid or missing id parameter" },
					{ status: 400 },
				);
			}
			try {
				const body = await req.json();
				const parsed = UpdateKnowledgeItemSchema.safeParse(body);
				if (!parsed.success) {
					return Response.json(
						{
							error: "Invalid request body",
							details: z.prettifyError(parsed.error),
						},
						{ status: 400 },
					);
				}

				const repo = await getKnowledgeRepo();
				const updatedItem = await repo.update(params.id, parsed.data);
				if (!updatedItem) {
					return Response.json(
						{ error: "Knowledge item not found" },
						{ status: 404 },
					);
				}
				return Response.json(updatedItem, { status: 200 });
			} catch (error) {
				log.api.error("Failed to update knowledge item:", error);
				return Response.json(
					{
						error: error instanceof Error ? error.message : "Unknown error",
					},
					{ status: 500 },
				);
			}
		},
	},
};
