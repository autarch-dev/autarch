import { create } from "zustand";
import type { PostWriteHooksConfig } from "@/shared/schemas/hooks";
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
	fetchHooksConfig,
	fetchIntegrationsStatus,
	fetchModelPreferences,
	setApiKey,
	setIntegrationKey,
	updateHooksConfig,
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

	// Hooks
	hooksConfig: PostWriteHooksConfig | null;
	loadHooksConfig: () => Promise<void>;
	saveHooksConfig: (hooks: PostWriteHooksConfig) => Promise<void>;

	// Persistent Approvals
	persistentApprovals: string[];
	loadPersistentApprovals: () => Promise<void>;
	removePersistentApproval: (command: string) => Promise<void>;
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

	// ---------------------------------------------------------------------------
	// Hooks
	// ---------------------------------------------------------------------------

	hooksConfig: null,

	loadHooksConfig: async () => {
		set({ isLoading: true, error: null });
		try {
			const config = await fetchHooksConfig();
			set({ hooksConfig: config, isLoading: false });
		} catch (err) {
			const message =
				err instanceof Error
					? err.message
					: "Failed to load hooks configuration";
			set({ error: message, isLoading: false });
		}
	},

	saveHooksConfig: async (hooks) => {
		set({ isLoading: true, error: null });
		try {
			await updateHooksConfig(hooks);
			set({ hooksConfig: hooks, isLoading: false });
		} catch (err) {
			const message =
				err instanceof Error
					? err.message
					: "Failed to save hooks configuration";
			set({ error: message, isLoading: false });
			throw err;
		}
	},

	// ---------------------------------------------------------------------------
	// Persistent Approvals
	// ---------------------------------------------------------------------------

	persistentApprovals: [],

	loadPersistentApprovals: async () => {
		try {
			const response = await fetch("/api/settings/persistent-approvals");
			if (response.ok) {
				const data = await response.json();
				set({ persistentApprovals: data.approvals ?? [] });
			} else {
				console.error(
					"Failed to load persistent approvals:",
					response.statusText,
				);
				set({ persistentApprovals: [] });
			}
		} catch (err) {
			console.error("Failed to load persistent approvals:", err);
			set({ persistentApprovals: [] });
		}
	},

	removePersistentApproval: async (command) => {
		try {
			const response = await fetch("/api/settings/persistent-approvals", {
				method: "DELETE",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ command }),
			});
			if (response.ok) {
				// Refresh the list after successful removal
				const refreshResponse = await fetch(
					"/api/settings/persistent-approvals",
				);
				if (refreshResponse.ok) {
					const data = await refreshResponse.json();
					set({ persistentApprovals: data.approvals ?? [] });
				}
			} else {
				console.error(
					"Failed to remove persistent approval:",
					response.statusText,
				);
			}
		} catch (err) {
			console.error("Failed to remove persistent approval:", err);
		}
	},
}));
