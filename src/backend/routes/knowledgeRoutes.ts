/**
 * Knowledge API Routes
 *
 * Routes for managing knowledge items.
 * Uses KnowledgeRepository for data access and searchKnowledge for semantic search.
 */

import { z } from "zod";
import { getKnowledgeDb } from "@/backend/db/knowledge";
import type { KnowledgeCategory } from "@/backend/db/knowledge/types";
import { embed } from "@/backend/services/embedding/provider";
import { KnowledgeRepository } from "@/backend/services/knowledge/repository";
import {
	type SearchFilters,
	searchKnowledge,
} from "@/backend/services/knowledge/search";
import {
	ArchiveKnowledgeItemSchema,
	KnowledgeCategorySchema,
	type KnowledgeItem,
	KnowledgeListFiltersSchema,
	type KnowledgeListResponse,
	KnowledgeSearchFiltersSchema,
	type KnowledgeSearchResponse,
	UpdateKnowledgeItemSchema,
} from "@/shared/schemas/knowledge";
import { log } from "../logger";
import { getProjectRoot } from "../projectRoot";

// =============================================================================
// Schemas
// =============================================================================

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
	category: KnowledgeCategorySchema,
	tags: z.array(z.string()).optional().default([]),
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
					"workflowId",
					"tags",
					"startDate",
					"endDate",
					"archived",
					"offset",
					"limit",
				]) {
					const value = searchParams.get(key);
					if (value !== null) {
						rawQuery[key] = value;
					}
				}

				const result = KnowledgeListFiltersSchema.safeParse(rawQuery);
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
					workflowId?: string;
					tags?: string[];
					startDate?: number;
					endDate?: number;
					archived?: boolean;
					offset?: number;
					limit?: number;
				} = {
					offset: data.offset,
					limit: data.limit,
				};

				if (data.category !== undefined) {
					filters.category = data.category;
				}
				if (data.workflowId !== undefined) {
					filters.workflowId = data.workflowId;
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
				filters.archived = data.archived === true;

				const [items, total] = await Promise.all([
					repo.search(filters),
					repo.count(filters),
				]);
				return Response.json({ items, total } satisfies KnowledgeListResponse);
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
				const embeddingText = `${parsed.data.title}\n\n${parsed.data.content}`;
				const embeddingResult = await embed(embeddingText);
				const embeddingBuffer = Buffer.from(embeddingResult.buffer);
				const id = await repo.createWithEmbedding(parsed.data, embeddingBuffer);
				const item = await repo.getById(id);

				return Response.json(item satisfies KnowledgeItem | null, {
					status: 201,
				});
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
					"workflowId",
					"tags",
					"startDate",
					"endDate",
					"archived",
					"limit",
				]) {
					const value = searchParams.get(key);
					if (value !== null) {
						rawQuery[key] = value;
					}
				}

				const result = KnowledgeSearchFiltersSchema.safeParse(rawQuery);
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
				if (data.workflowId !== undefined) {
					filters.workflowId = data.workflowId;
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
				filters.archived = data.archived === true;

				const results = await searchKnowledge(data.query, filters, projectRoot);
				return Response.json({ results } satisfies KnowledgeSearchResponse);
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
		async GET(req: Request) {
			const params = parseParams(req, IdParamSchema);
			if (!params) {
				return Response.json(
					{ error: "Invalid or missing id parameter" },
					{ status: 400 },
				);
			}
			try {
				const repo = await getKnowledgeRepo();
				const item = await repo.getById(params.id);
				if (!item) {
					return Response.json(
						{ error: "Knowledge item not found" },
						{ status: 404 },
					);
				}
				return Response.json(item satisfies KnowledgeItem);
			} catch (error) {
				log.api.error("Failed to get knowledge item:", error);
				return Response.json(
					{
						error: error instanceof Error ? error.message : "Unknown error",
					},
					{ status: 500 },
				);
			}
		},

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
				return Response.json(updatedItem satisfies KnowledgeItem, {
					status: 200,
				});
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

	"/api/knowledge/:id/archive": {
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
				const parsed = ArchiveKnowledgeItemSchema.safeParse(body);
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
				const updatedItem = await repo.update(params.id, {
					archived: parsed.data.archived,
				});
				if (!updatedItem) {
					return Response.json(
						{ error: "Knowledge item not found" },
						{ status: 404 },
					);
				}
				return Response.json(updatedItem satisfies KnowledgeItem);
			} catch (error) {
				log.api.error("Failed to archive knowledge item:", error);
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
