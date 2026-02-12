/**
 * Analytics Dashboard Store
 *
 * Zustand store for managing analytics data.
 * Handles fetching, filtering, and state for all analytics dashboard views.
 */

import { create } from "zustand";
import type {
	AnalyticsFilters,
	FailurePatterns,
	StageDuration,
	SuccessFailureRate,
	Throughput,
} from "@/shared/schemas/analytics";
import {
	fetchFailures,
	fetchStages,
	fetchSummary,
	fetchThroughput,
} from "../api/analyticsApi";

// =============================================================================
// Types
// =============================================================================

/** Loading state for a single data section */
interface DataSection<T> {
	data: T | null;
	loading: boolean;
	error: string | null;
}

// =============================================================================
// Store State
// =============================================================================

interface AnalyticsState {
	// Data sections
	summary: DataSection<SuccessFailureRate>;
	stages: DataSection<StageDuration>;
	failures: DataSection<FailurePatterns>;
	throughput: DataSection<Throughput>;

	// Filters
	filters: AnalyticsFilters;

	// Actions
	setFilters: (filters: Partial<AnalyticsFilters>) => void;
	fetchAll: () => Promise<void>;
	fetchSummary: () => Promise<void>;
	fetchStages: () => Promise<void>;
	fetchFailures: () => Promise<void>;
	fetchThroughput: () => Promise<void>;
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

export const useAnalyticsStore = create<AnalyticsState>((set, get) => ({
	// ---------------------------------------------------------------------------
	// State
	// ---------------------------------------------------------------------------

	summary: initialSection(),
	stages: initialSection(),
	failures: initialSection(),
	throughput: initialSection(),

	filters: {},

	// ---------------------------------------------------------------------------
	// Actions - Filters
	// ---------------------------------------------------------------------------

	setFilters: (partial) => {
		set((state) => ({
			filters: { ...state.filters, ...partial },
		}));
	},

	// ---------------------------------------------------------------------------
	// Actions - Fetch All
	// ---------------------------------------------------------------------------

	fetchAll: async () => {
		++_fetchId;
		const { fetchSummary, fetchStages, fetchFailures, fetchThroughput } = get();
		await Promise.all([
			fetchSummary(),
			fetchStages(),
			fetchFailures(),
			fetchThroughput(),
		]);
	},

	// ---------------------------------------------------------------------------
	// Actions - Individual Fetches
	// ---------------------------------------------------------------------------

	fetchSummary: async () => {
		const id = _fetchId;
		set((s) => ({ summary: { ...s.summary, loading: true, error: null } }));
		try {
			const data = await fetchSummary(get().filters);
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

	fetchStages: async () => {
		const id = _fetchId;
		set((s) => ({ stages: { ...s.stages, loading: true, error: null } }));
		try {
			const data = await fetchStages(get().filters);
			if (_fetchId !== id) return;
			set({ stages: { data, loading: false, error: null } });
		} catch (error) {
			if (_fetchId !== id) return;
			set({
				stages: {
					data: null,
					loading: false,
					error: error instanceof Error ? error.message : "Unknown error",
				},
			});
		}
	},

	fetchFailures: async () => {
		const id = _fetchId;
		set((s) => ({ failures: { ...s.failures, loading: true, error: null } }));
		try {
			const data = await fetchFailures(get().filters);
			if (_fetchId !== id) return;
			set({ failures: { data, loading: false, error: null } });
		} catch (error) {
			if (_fetchId !== id) return;
			set({
				failures: {
					data: null,
					loading: false,
					error: error instanceof Error ? error.message : "Unknown error",
				},
			});
		}
	},

	fetchThroughput: async () => {
		const id = _fetchId;
		set((s) => ({
			throughput: { ...s.throughput, loading: true, error: null },
		}));
		try {
			const data = await fetchThroughput(get().filters);
			if (_fetchId !== id) return;
			set({ throughput: { data, loading: false, error: null } });
		} catch (error) {
			if (_fetchId !== id) return;
			set({
				throughput: {
					data: null,
					loading: false,
					error: error instanceof Error ? error.message : "Unknown error",
				},
			});
		}
	},
}));
