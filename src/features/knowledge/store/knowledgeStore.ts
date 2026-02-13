/**
 * Knowledge Management Store
 *
 * Zustand store for managing knowledge item data.
 * Handles fetching, searching, filtering, and mutations for the knowledge UI.
 */

import { create } from "zustand";
import type {
	KnowledgeCategory,
	KnowledgeItem,
	UpdateKnowledgeItem,
} from "@/shared/schemas/knowledge";
import {
	archiveKnowledgeItem,
	deleteKnowledgeItem,
	fetchKnowledgeItems,
	getKnowledgeItem,
	searchKnowledge,
	updateKnowledgeItem,
} from "../api/knowledgeApi";

// =============================================================================
// Types
// =============================================================================

/** Loading state for a single data section */
interface DataSection<T> {
	data: T | null;
	loading: boolean;
	error: string | null;
}

/** Optional filter state for knowledge list queries */
interface KnowledgeFilters {
	category?: KnowledgeCategory;
	workflowId?: string;
	tags?: string;
	startDate?: number;
	endDate?: number;
	archived?: boolean;
	offset?: number;
	limit?: number;
}

// =============================================================================
// Store State
// =============================================================================

interface KnowledgeStore {
	// Data sections
	items: DataSection<{ items: KnowledgeItem[]; total: number }>;
	searchResults: DataSection<{
		results: (KnowledgeItem & { similarity: number })[];
	}>;
	selectedItem: DataSection<KnowledgeItem>;

	// Filters & search
	filters: KnowledgeFilters;
	searchQuery: string;

	// Actions - Filters
	setFilters: (partial: Partial<KnowledgeFilters>) => void;
	setSearchQuery: (query: string) => void;

	// Actions - Fetching
	fetchItems: () => Promise<void>;
	searchItems: () => Promise<void>;
	fetchItem: (id: string) => Promise<void>;
	fetchAll: () => void;

	// Actions - Mutations
	updateItem: (id: string, data: UpdateKnowledgeItem) => Promise<void>;
	archiveItem: (id: string, archived: boolean) => Promise<void>;
	deleteItem: (id: string) => Promise<void>;
}

// =============================================================================
// Initial section state
// =============================================================================

function initialSection<T>(): DataSection<T> {
	return { data: null, loading: false, error: null };
}

// =============================================================================
// Store
// =============================================================================

/**
 * Global fetch counter — incremented by fetchAll() so that in-flight requests
 * from a previous fetchAll() discard their results when a newer one starts.
 */
let _fetchId = 0;

export const useKnowledgeStore = create<KnowledgeStore>((set, get) => ({
	// ---------------------------------------------------------------------------
	// State
	// ---------------------------------------------------------------------------

	items: initialSection(),
	searchResults: initialSection(),
	selectedItem: initialSection(),

	filters: {},
	searchQuery: "",

	// ---------------------------------------------------------------------------
	// Actions - Filters
	// ---------------------------------------------------------------------------

	setFilters: (partial) => {
		set((state) => ({
			filters: { ...state.filters, ...partial },
		}));
	},

	setSearchQuery: (query) => {
		set({ searchQuery: query });
	},

	// ---------------------------------------------------------------------------
	// Actions - Fetch All
	// ---------------------------------------------------------------------------

	fetchAll: () => {
		++_fetchId;
		const { fetchItems } = get();
		fetchItems();
	},

	// ---------------------------------------------------------------------------
	// Actions - Fetching
	// ---------------------------------------------------------------------------

	fetchItems: async () => {
		const id = _fetchId;
		set((s) => ({ items: { ...s.items, loading: true, error: null } }));
		try {
			const data = await fetchKnowledgeItems(get().filters);
			if (_fetchId !== id) return;
			set({ items: { data, loading: false, error: null } });
		} catch (error) {
			if (_fetchId !== id) return;
			set({
				items: {
					data: null,
					loading: false,
					error: error instanceof Error ? error.message : "Unknown error",
				},
			});
		}
	},

	searchItems: async () => {
		const id = _fetchId;
		const { searchQuery, filters } = get();
		if (!searchQuery.trim()) return;

		set((s) => ({
			searchResults: { ...s.searchResults, loading: true, error: null },
		}));
		try {
			const data = await searchKnowledge(searchQuery, filters);
			if (_fetchId !== id) return;
			set({ searchResults: { data, loading: false, error: null } });
		} catch (error) {
			if (_fetchId !== id) return;
			set({
				searchResults: {
					data: null,
					loading: false,
					error: error instanceof Error ? error.message : "Unknown error",
				},
			});
		}
	},

	fetchItem: async (itemId) => {
		set((s) => ({
			selectedItem: { ...s.selectedItem, loading: true, error: null },
		}));
		try {
			const data = await getKnowledgeItem(itemId);
			set({ selectedItem: { data, loading: false, error: null } });
		} catch (error) {
			set({
				selectedItem: {
					data: null,
					loading: false,
					error: error instanceof Error ? error.message : "Unknown error",
				},
			});
		}
	},

	// ---------------------------------------------------------------------------
	// Actions - Mutations
	// ---------------------------------------------------------------------------

	updateItem: async (itemId, data) => {
		try {
			await updateKnowledgeItem(itemId, data);
			await get().fetchItems();
		} catch (error) {
			set({
				items: {
					...get().items,
					error: error instanceof Error ? error.message : "Unknown error",
				},
			});
			throw error;
		}
	},

	archiveItem: async (itemId, archived) => {
		try {
			await archiveKnowledgeItem(itemId, archived);
			await get().fetchItems();
		} catch (error) {
			set({
				items: {
					...get().items,
					error: error instanceof Error ? error.message : "Unknown error",
				},
			});
		}
	},

	deleteItem: async (itemId) => {
		try {
			await deleteKnowledgeItem(itemId);
			await get().fetchItems();
		} catch (error) {
			set({
				items: {
					...get().items,
					error: error instanceof Error ? error.message : "Unknown error",
				},
			});
		}
	},
}));
