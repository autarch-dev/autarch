import { create } from "zustand";
import type {
	AIProvider,
	ApiKeysResponse,
	IntegrationsStatusResponse,
	ModelPreferences,
} from "@/shared/schemas/settings";
import {
	clearApiKey,
	clearIntegrationKey,
	fetchApiKeysStatus,
	fetchIntegrationsStatus,
	fetchModelPreferences,
	setApiKey,
	setIntegrationKey,
	updateModelPreferences,
} from "../api/settingsApi";

// =============================================================================
// Types
// =============================================================================

interface SettingsState {
	// Loading states
	isLoading: boolean;
	error: string | null;

	// API keys
	apiKeysStatus: ApiKeysResponse | null;
	loadApiKeysStatus: () => Promise<void>;
	saveApiKey: (provider: AIProvider, key: string) => Promise<void>;
	clearApiKey: (provider: AIProvider) => Promise<void>;

	// Integrations
	integrationsStatus: IntegrationsStatusResponse | null;
	loadIntegrationsStatus: () => Promise<void>;
	saveIntegrationKey: (key: string) => Promise<void>;
	clearIntegrationKey: () => Promise<void>;

	// Model preferences
	modelPreferences: ModelPreferences | null;
	loadModelPreferences: () => Promise<void>;
	saveModelPreferences: (prefs: ModelPreferences) => Promise<void>;
}

// =============================================================================
// Store
// =============================================================================

export const useSettings = create<SettingsState>((set) => ({
	// ---------------------------------------------------------------------------
	// Loading States
	// ---------------------------------------------------------------------------

	isLoading: false,
	error: null,

	// ---------------------------------------------------------------------------
	// API Keys
	// ---------------------------------------------------------------------------

	apiKeysStatus: null,

	loadApiKeysStatus: async () => {
		set({ isLoading: true, error: null });
		try {
			const status = await fetchApiKeysStatus();
			set({ apiKeysStatus: status, isLoading: false });
		} catch (err) {
			const message =
				err instanceof Error ? err.message : "Failed to load API keys";
			set({ error: message, isLoading: false });
		}
	},

	saveApiKey: async (provider, key) => {
		set({ isLoading: true, error: null });
		try {
			await setApiKey(provider, key);
			// Refresh status after saving
			const status = await fetchApiKeysStatus();
			set({ apiKeysStatus: status, isLoading: false });
		} catch (err) {
			const message =
				err instanceof Error ? err.message : "Failed to save API key";
			set({ error: message, isLoading: false });
			throw err;
		}
	},

	clearApiKey: async (provider) => {
		set({ isLoading: true, error: null });
		try {
			await clearApiKey(provider);
			// Refresh status after clearing
			const status = await fetchApiKeysStatus();
			set({ apiKeysStatus: status, isLoading: false });
		} catch (err) {
			const message =
				err instanceof Error ? err.message : "Failed to clear API key";
			set({ error: message, isLoading: false });
			throw err;
		}
	},

	// ---------------------------------------------------------------------------
	// Integrations
	// ---------------------------------------------------------------------------

	integrationsStatus: null,

	loadIntegrationsStatus: async () => {
		set({ isLoading: true, error: null });
		try {
			const status = await fetchIntegrationsStatus();
			set({ integrationsStatus: status, isLoading: false });
		} catch (err) {
			const message =
				err instanceof Error
					? err.message
					: "Failed to load integrations status";
			set({ error: message, isLoading: false });
		}
	},

	saveIntegrationKey: async (key) => {
		set({ isLoading: true, error: null });
		try {
			await setIntegrationKey(key);
			// Refresh status after saving
			const status = await fetchIntegrationsStatus();
			set({ integrationsStatus: status, isLoading: false });
		} catch (err) {
			const message =
				err instanceof Error ? err.message : "Failed to save integration key";
			set({ error: message, isLoading: false });
			throw err;
		}
	},

	clearIntegrationKey: async () => {
		set({ isLoading: true, error: null });
		try {
			await clearIntegrationKey();
			// Refresh status after clearing
			const status = await fetchIntegrationsStatus();
			set({ integrationsStatus: status, isLoading: false });
		} catch (err) {
			const message =
				err instanceof Error ? err.message : "Failed to clear integration key";
			set({ error: message, isLoading: false });
			throw err;
		}
	},

	// ---------------------------------------------------------------------------
	// Model Preferences
	// ---------------------------------------------------------------------------

	modelPreferences: null,

	loadModelPreferences: async () => {
		set({ isLoading: true, error: null });
		try {
			const prefs = await fetchModelPreferences();
			set({ modelPreferences: prefs, isLoading: false });
		} catch (err) {
			const message =
				err instanceof Error ? err.message : "Failed to load model preferences";
			set({ error: message, isLoading: false });
		}
	},

	saveModelPreferences: async (prefs) => {
		set({ isLoading: true, error: null });
		try {
			await updateModelPreferences(prefs);
			set({ modelPreferences: prefs, isLoading: false });
		} catch (err) {
			const message =
				err instanceof Error ? err.message : "Failed to save model preferences";
			set({ error: message, isLoading: false });
			throw err;
		}
	},
}));
