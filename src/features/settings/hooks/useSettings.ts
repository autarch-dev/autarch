import { create } from "zustand";
import type { GitIdentity } from "@/shared/schemas/git-identity";
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
	fetchGitIdentity,
	fetchHooksConfig,
	fetchIntegrationsStatus,
	fetchModelPreferences,
	fetchPersistentApprovals,
	removePersistentApproval,
	setApiKey,
	setIntegrationKey,
	updateGitIdentity,
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

	// Git Identity
	gitIdentity: GitIdentity | null;
	loadGitIdentity: () => Promise<void>;
	saveGitIdentity: (identity: GitIdentity) => Promise<void>;
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
			const data = await fetchPersistentApprovals();
			set({ persistentApprovals: data.approvals ?? [] });
		} catch (err) {
			console.error("Failed to load persistent approvals:", err);
			set({ persistentApprovals: [] });
		}
	},

	removePersistentApproval: async (command) => {
		try {
			await removePersistentApproval(command);
			// Refresh the list after successful removal
			const data = await fetchPersistentApprovals();
			set({ persistentApprovals: data.approvals ?? [] });
		} catch (err) {
			console.error("Failed to remove persistent approval:", err);
		}
	},

	// ---------------------------------------------------------------------------
	// Git Identity
	// ---------------------------------------------------------------------------

	gitIdentity: null,

	loadGitIdentity: async () => {
		set({ isLoading: true, error: null });
		try {
			const identity = await fetchGitIdentity();
			set({ gitIdentity: identity, isLoading: false });
		} catch (err) {
			const message =
				err instanceof Error ? err.message : "Failed to load git identity";
			set({ error: message, isLoading: false });
		}
	},

	saveGitIdentity: async (identity) => {
		set({ isLoading: true, error: null });
		try {
			await updateGitIdentity(identity);
			set({ gitIdentity: identity, isLoading: false });
		} catch (err) {
			const message =
				err instanceof Error ? err.message : "Failed to save git identity";
			set({ error: message, isLoading: false });
			throw err;
		}
	},
}));
