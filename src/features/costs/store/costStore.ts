/**
 * Cost Dashboard Store
 *
 * Zustand store for managing cost analytics data.
 * Handles fetching, filtering, and state for all cost dashboard views.
 */

import { create } from "zustand";
import type {
	CostByModel,
	CostByRole,
	CostByWorkflow,
	CostFilters,
	CostSummary,
	CostTokenUsage,
	CostTrend,
} from "@/shared/schemas/costs";
import {
	fetchCostByModel,
	fetchCostByRole,
	fetchCostByWorkflow,
	fetchCostSummary,
	fetchCostTokenUsage,
	fetchCostTrends,
} from "../api/costApi";

// =============================================================================
// Types
// =============================================================================

/** Loading state for a single data section */
interface DataSection<T> {
	data: T | null;
	loading: boolean;
	error: string | null;
}

/** Granularity for trend data */
type Granularity = "daily" | "weekly";

// =============================================================================
// Store State
// =============================================================================

interface CostDashboardState {
	// Data sections
	summary: DataSection<CostSummary>;
	byModel: DataSection<CostByModel>;
	byRole: DataSection<CostByRole>;
	trends: DataSection<CostTrend>;
	tokens: DataSection<CostTokenUsage>;
	byWorkflow: DataSection<CostByWorkflow>;

	// Filters
	filters: CostFilters;
	granularity: Granularity;

	// Actions
	setFilters: (partial: Partial<CostFilters>) => void;
	setGranularity: (granularity: Granularity) => void;
	fetchAll: () => Promise<void>;
	fetchSummary: () => Promise<void>;
	fetchByModel: () => Promise<void>;
	fetchByRole: () => Promise<void>;
	fetchTrends: () => Promise<void>;
	fetchTokens: () => Promise<void>;
	fetchByWorkflow: () => Promise<void>;
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

export const useCostStore = create<CostDashboardState>((set, get) => ({
	// ---------------------------------------------------------------------------
	// State
	// ---------------------------------------------------------------------------

	summary: initialSection(),
	byModel: initialSection(),
	byRole: initialSection(),
	trends: initialSection(),
	tokens: initialSection(),
	byWorkflow: initialSection(),

	filters: {},
	granularity: "daily",

	// ---------------------------------------------------------------------------
	// Actions - Filters
	// ---------------------------------------------------------------------------

	setFilters: (partial) => {
		set((state) => ({
			filters: { ...state.filters, ...partial },
		}));
	},

	setGranularity: (granularity) => {
		set({ granularity });
	},

	// ---------------------------------------------------------------------------
	// Actions - Fetch All
	// ---------------------------------------------------------------------------

	fetchAll: async () => {
		++_fetchId;
		const {
			fetchSummary,
			fetchByModel,
			fetchByRole,
			fetchTrends,
			fetchTokens,
			fetchByWorkflow,
		} = get();
		await Promise.all([
			fetchSummary(),
			fetchByModel(),
			fetchByRole(),
			fetchTrends(),
			fetchTokens(),
			fetchByWorkflow(),
		]);
	},

	// ---------------------------------------------------------------------------
	// Actions - Individual Fetches
	// ---------------------------------------------------------------------------

	fetchSummary: async () => {
		const id = _fetchId;
		set((s) => ({ summary: { ...s.summary, loading: true, error: null } }));
		try {
			const data = await fetchCostSummary(get().filters);
			if (_fetchId !== id) return;
			set({ summary: { data, loading: false, error: null } });
		} catch (error) {
			if (_fetchId !== id) return;
			set({
				summary: {
					data: null,
					loading: false,
					error: error instanceof Error ? error.message : "Unknown error",
				},
			});
		}
	},

	fetchByModel: async () => {
		const id = _fetchId;
		set((s) => ({ byModel: { ...s.byModel, loading: true, error: null } }));
		try {
			const data = await fetchCostByModel(get().filters);
			if (_fetchId !== id) return;
			set({ byModel: { data, loading: false, error: null } });
		} catch (error) {
			if (_fetchId !== id) return;
			set({
				byModel: {
					data: null,
					loading: false,
					error: error instanceof Error ? error.message : "Unknown error",
				},
			});
		}
	},

	fetchByRole: async () => {
		const id = _fetchId;
		set((s) => ({ byRole: { ...s.byRole, loading: true, error: null } }));
		try {
			const data = await fetchCostByRole(get().filters);
			if (_fetchId !== id) return;
			set({ byRole: { data, loading: false, error: null } });
		} catch (error) {
			if (_fetchId !== id) return;
			set({
				byRole: {
					data: null,
					loading: false,
					error: error instanceof Error ? error.message : "Unknown error",
				},
			});
		}
	},

	fetchTrends: async () => {
		const id = _fetchId;
		set((s) => ({ trends: { ...s.trends, loading: true, error: null } }));
		try {
			const data = await fetchCostTrends(get().filters, get().granularity);
			if (_fetchId !== id) return;
			set({ trends: { data, loading: false, error: null } });
		} catch (error) {
			if (_fetchId !== id) return;
			set({
				trends: {
					data: null,
					loading: false,
					error: error instanceof Error ? error.message : "Unknown error",
				},
			});
		}
	},

	fetchTokens: async () => {
		const id = _fetchId;
		set((s) => ({ tokens: { ...s.tokens, loading: true, error: null } }));
		try {
			const data = await fetchCostTokenUsage(get().filters);
			if (_fetchId !== id) return;
			set({ tokens: { data, loading: false, error: null } });
		} catch (error) {
			if (_fetchId !== id) return;
			set({
				tokens: {
					data: null,
					loading: false,
					error: error instanceof Error ? error.message : "Unknown error",
				},
			});
		}
	},

	fetchByWorkflow: async () => {
		const id = _fetchId;
		set((s) => ({
			byWorkflow: { ...s.byWorkflow, loading: true, error: null },
		}));
		try {
			const data = await fetchCostByWorkflow(get().filters);
			if (_fetchId !== id) return;
			set({ byWorkflow: { data, loading: false, error: null } });
		} catch (error) {
			if (_fetchId !== id) return;
			set({
				byWorkflow: {
					data: null,
					loading: false,
					error: error instanceof Error ? error.message : "Unknown error",
				},
			});
		}
	},
}));
