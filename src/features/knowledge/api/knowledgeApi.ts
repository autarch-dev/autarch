import type {
	KnowledgeItem,
	KnowledgeListFilters,
	KnowledgeListResponse,
	KnowledgeSearchFilters,
	KnowledgeSearchResponse,
	UpdateKnowledgeItem,
} from "@/shared/schemas/knowledge";
import {
	KnowledgeItemSchema,
	KnowledgeListResponseSchema,
	KnowledgeSearchResponseSchema,
	KnowledgeTagsResponseSchema,
} from "@/shared/schemas/knowledge";

// =============================================================================
// Helpers
// =============================================================================

/**
 * Build URLSearchParams from non-undefined/null filter values.
 */
function buildFilterParams(
	filters: Partial<KnowledgeListFilters>,
): URLSearchParams {
	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(filters)) {
		if (value !== undefined && value !== null) {
			params.set(key, String(value));
		}
	}
	return params;
}

/**
 * Build a URL with optional query params.
 */
function buildUrl(path: string, params: URLSearchParams): string {
	const query = params.toString();
	return query ? `${path}?${query}` : path;
}

// =============================================================================
// API Functions
// =============================================================================

/**
 * Fetch a paginated list of knowledge items with optional filters.
 */
export async function fetchKnowledgeItems(
	filters: Partial<KnowledgeListFilters> = {},
): Promise<KnowledgeListResponse> {
	const url = buildUrl("/api/knowledge", buildFilterParams(filters));
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Failed to fetch knowledge items: ${response.statusText}`);
	}
	const data = await response.json();
	return KnowledgeListResponseSchema.parse(data);
}

/**
 * Search knowledge items by query with optional filters.
 */
export async function searchKnowledge(
	query: string,
	filters: Partial<Omit<KnowledgeSearchFilters, "query">> = {},
): Promise<KnowledgeSearchResponse> {
	const params = buildFilterParams(filters);
	params.set("query", query);
	const url = buildUrl("/api/knowledge/search", params);
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Failed to search knowledge: ${response.statusText}`);
	}
	const data = await response.json();
	return KnowledgeSearchResponseSchema.parse(data);
}

/**
 * Fetch a single knowledge item by ID.
 */
export async function getKnowledgeItem(id: string): Promise<KnowledgeItem> {
	const response = await fetch(`/api/knowledge/${encodeURIComponent(id)}`);
	if (!response.ok) {
		throw new Error(`Failed to fetch knowledge item: ${response.statusText}`);
	}
	const data = await response.json();
	return KnowledgeItemSchema.parse(data);
}

/**
 * Update a knowledge item (title, content, category, tags).
 */
export async function updateKnowledgeItem(
	id: string,
	data: UpdateKnowledgeItem,
): Promise<KnowledgeItem> {
	const response = await fetch(`/api/knowledge/${encodeURIComponent(id)}`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(data),
	});
	if (!response.ok) {
		throw new Error(`Failed to update knowledge item: ${response.statusText}`);
	}
	const result = await response.json();
	return KnowledgeItemSchema.parse(result);
}

/**
 * Archive or unarchive a knowledge item.
 */
export async function archiveKnowledgeItem(
	id: string,
	archived: boolean,
): Promise<KnowledgeItem> {
	const response = await fetch(
		`/api/knowledge/${encodeURIComponent(id)}/archive`,
		{
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ archived }),
		},
	);
	if (!response.ok) {
		throw new Error(`Failed to archive knowledge item: ${response.statusText}`);
	}
	const result = await response.json();
	return KnowledgeItemSchema.parse(result);
}

/**
 * Delete a knowledge item permanently.
 */
export async function deleteKnowledgeItem(id: string): Promise<void> {
	const response = await fetch(`/api/knowledge/${encodeURIComponent(id)}`, {
		method: "DELETE",
	});
	if (!response.ok) {
		throw new Error(`Failed to delete knowledge item: ${response.statusText}`);
	}
}

/**
 * Fetch all distinct tags from non-archived knowledge items.
 */
export async function fetchKnowledgeTags(): Promise<string[]> {
	const response = await fetch("/api/knowledge/tags");
	if (!response.ok) {
		throw new Error(`Failed to fetch knowledge tags: ${response.statusText}`);
	}
	const data = await response.json();
	const parsed = KnowledgeTagsResponseSchema.parse(data);
	return parsed.tags;
}
