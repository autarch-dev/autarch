import { create } from "zustand";
import type {
	AIProvider,
	ApiKeysResponse,
	ModelPreferences,
} from "@/shared/schemas/settings";
import {
	completeOnboarding,
	fetchApiKeysStatus,
	fetchGitIdentity,
	fetchGitIdentityDefaults,
	fetchModelPreferences,
	fetchOnboardingStatus,
	saveGitIdentity as saveGitIdentityApi,
	setApiKey,
	updateModelPreferences,
} from "../api/settingsApi";

// =============================================================================
// Types
// =============================================================================

export type WizardStep =
	| "intro"
	| "features"
	| "api-keys"
	| "model-prefs"
	| "git-identity"
	| "complete";

interface OnboardingState {
	// Wizard navigation
	currentStep: WizardStep;
	setStep: (step: WizardStep) => void;
	nextStep: () => void;
	prevStep: () => void;

	// Loading states
	isLoading: boolean;
	error: string | null;

	// API keys
	apiKeysStatus: ApiKeysResponse | null;
	loadApiKeysStatus: () => Promise<void>;
	saveApiKey: (provider: AIProvider, key: string) => Promise<void>;

	// Model preferences
	modelPreferences: ModelPreferences | null;
	loadModelPreferences: () => Promise<void>;
	saveModelPreferences: (prefs: ModelPreferences) => Promise<void>;

	// Git identity
	gitIdentityName: string;
	gitIdentityEmail: string;
	setGitIdentityName: (name: string) => void;
	setGitIdentityEmail: (email: string) => void;
	loadGitIdentityDefaults: () => Promise<void>;
	saveGitIdentity: () => Promise<void>;

	// Onboarding completion
	checkOnboardingStatus: () => Promise<boolean>;
	finishOnboarding: () => Promise<void>;
}

// =============================================================================
// Step Order
// =============================================================================

const STEP_ORDER: WizardStep[] = [
	"intro",
	"features",
	"api-keys",
	"model-prefs",
	"git-identity",
	"complete",
];

// =============================================================================
// Store
// =============================================================================

export const useOnboarding = create<OnboardingState>((set, get) => ({
	// ---------------------------------------------------------------------------
	// Wizard Navigation
	// ---------------------------------------------------------------------------

	currentStep: "intro",

	setStep: (step) => set({ currentStep: step }),

	nextStep: () => {
		const { currentStep } = get();
		const currentIndex = STEP_ORDER.indexOf(currentStep);
		const nextIndex = Math.min(currentIndex + 1, STEP_ORDER.length - 1);
		const nextStep = STEP_ORDER[nextIndex];
		if (nextStep) {
			set({ currentStep: nextStep });
		}
	},

	prevStep: () => {
		const { currentStep } = get();
		const currentIndex = STEP_ORDER.indexOf(currentStep);
		const prevIndex = Math.max(currentIndex - 1, 0);
		const prevStep = STEP_ORDER[prevIndex];
		if (prevStep) {
			set({ currentStep: prevStep });
		}
	},

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
	// Git Identity
	// ---------------------------------------------------------------------------

	gitIdentityName: "",
	gitIdentityEmail: "",

	setGitIdentityName: (name) => set({ gitIdentityName: name }),
	setGitIdentityEmail: (email) => set({ gitIdentityEmail: email }),

	loadGitIdentityDefaults: async () => {
		set({ isLoading: true, error: null });
		try {
			// First check if values are already saved
			try {
				const saved = await fetchGitIdentity();
				if (saved.name || saved.email) {
					set({
						gitIdentityName: saved.name,
						gitIdentityEmail: saved.email,
						isLoading: false,
					});
					return;
				}
			} catch {
				// No saved identity, fall through to defaults
			}
			const defaults = await fetchGitIdentityDefaults();
			set({
				gitIdentityName: defaults.name ?? "",
				gitIdentityEmail: defaults.email ?? "",
				isLoading: false,
			});
		} catch (err) {
			const message =
				err instanceof Error ? err.message : "Failed to load git identity";
			set({ error: message, isLoading: false });
		}
	},

	saveGitIdentity: async () => {
		set({ isLoading: true, error: null });
		try {
			await saveGitIdentityApi({
				name: get().gitIdentityName,
				email: get().gitIdentityEmail,
			});
			set({ isLoading: false });
		} catch (err) {
			const message =
				err instanceof Error ? err.message : "Failed to save git identity";
			set({ error: message, isLoading: false });
			throw err;
		}
	},

	// ---------------------------------------------------------------------------
	// Onboarding Completion
	// ---------------------------------------------------------------------------

	checkOnboardingStatus: async () => {
		try {
			return await fetchOnboardingStatus();
		} catch {
			return false;
		}
	},

	finishOnboarding: async () => {
		set({ isLoading: true, error: null });
		try {
			await completeOnboarding();
			set({ isLoading: false });
		} catch (err) {
			const message =
				err instanceof Error ? err.message : "Failed to complete onboarding";
			set({ error: message, isLoading: false });
			throw err;
		}
	},
}));
