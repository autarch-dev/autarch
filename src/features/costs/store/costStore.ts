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
		set({ summary: { data: null, loading: true, error: null } });
		try {
			const data = await fetchCostSummary(get().filters);
			set({ summary: { data, loading: false, error: null } });
		} catch (error) {
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
		set({ byModel: { data: null, loading: true, error: null } });
		try {
			const data = await fetchCostByModel(get().filters);
			set({ byModel: { data, loading: false, error: null } });
		} catch (error) {
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
		set({ byRole: { data: null, loading: true, error: null } });
		try {
			const data = await fetchCostByRole(get().filters);
			set({ byRole: { data, loading: false, error: null } });
		} catch (error) {
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
		set({ trends: { data: null, loading: true, error: null } });
		try {
			const data = await fetchCostTrends(get().filters, get().granularity);
			set({ trends: { data, loading: false, error: null } });
		} catch (error) {
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
		set({ tokens: { data: null, loading: true, error: null } });
		try {
			const data = await fetchCostTokenUsage(get().filters);
			set({ tokens: { data, loading: false, error: null } });
		} catch (error) {
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
		set({ byWorkflow: { data: null, loading: true, error: null } });
		try {
			const data = await fetchCostByWorkflow(get().filters);
			set({ byWorkflow: { data, loading: false, error: null } });
		} catch (error) {
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
