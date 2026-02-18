import { create } from "zustand";
import type {
	CustomModel,
	CustomProvider,
} from "@/shared/schemas/custom-providers";
import {
	clearCustomProviderApiKey,
	createCustomModel,
	createCustomProvider,
	deleteCustomModel,
	deleteCustomProvider,
	fetchCustomModels,
	fetchCustomProviders,
	setCustomProviderApiKey,
	updateCustomModel,
	updateCustomProvider,
} from "../api/customProvidersApi";

interface CustomProvidersState {
	providers: CustomProvider[];
	modelsByProvider: Record<string, CustomModel[]>;
	isLoading: boolean;
	error: string | null;

	loadProviders: () => Promise<void>;
	addProvider: (provider: CustomProvider) => Promise<void>;
	editProvider: (
		id: string,
		updates: Partial<Omit<CustomProvider, "id">>,
	) => Promise<void>;
	removeProvider: (id: string) => Promise<void>;

	saveProviderApiKey: (providerId: string, key: string) => Promise<void>;
	clearProviderApiKey: (providerId: string) => Promise<void>;

	loadModels: (providerId: string) => Promise<void>;
	addModel: (
		providerId: string,
		model: Omit<CustomModel, "id" | "providerId">,
	) => Promise<void>;
	editModel: (
		modelId: string,
		updates: Partial<Omit<CustomModel, "id" | "providerId">>,
	) => Promise<void>;
	removeModel: (modelId: string, providerId: string) => Promise<void>;
}

export const useCustomProviders = create<CustomProvidersState>((set, get) => ({
	providers: [],
	modelsByProvider: {},
	isLoading: false,
	error: null,

	loadProviders: async () => {
		set({ isLoading: true, error: null });
		try {
			const providers = await fetchCustomProviders();
			set({ providers, isLoading: false });

			// Load models for all providers in parallel
			await Promise.all(providers.map((p) => get().loadModels(p.id)));
		} catch (err) {
			set({
				error:
					err instanceof Error
						? err.message
						: "Failed to load custom providers",
				isLoading: false,
			});
		}
	},

	addProvider: async (provider) => {
		set({ isLoading: true, error: null });
		try {
			await createCustomProvider(provider);
			const providers = await fetchCustomProviders();
			set({ providers, isLoading: false });
		} catch (err) {
			set({
				error: err instanceof Error ? err.message : "Failed to create provider",
				isLoading: false,
			});
			throw err;
		}
	},

	editProvider: async (id, updates) => {
		set({ isLoading: true, error: null });
		try {
			await updateCustomProvider(id, updates);
			const providers = await fetchCustomProviders();
			set({ providers, isLoading: false });
		} catch (err) {
			set({
				error: err instanceof Error ? err.message : "Failed to update provider",
				isLoading: false,
			});
			throw err;
		}
	},

	removeProvider: async (id) => {
		set({ isLoading: true, error: null });
		try {
			await deleteCustomProvider(id);
			const providers = await fetchCustomProviders();
			const { modelsByProvider } = get();
			const { [id]: _, ...rest } = modelsByProvider;
			set({ providers, modelsByProvider: rest, isLoading: false });
		} catch (err) {
			set({
				error: err instanceof Error ? err.message : "Failed to delete provider",
				isLoading: false,
			});
			throw err;
		}
	},

	saveProviderApiKey: async (providerId, key) => {
		set({ isLoading: true, error: null });
		try {
			await setCustomProviderApiKey(providerId, key);
			set({ isLoading: false });
		} catch (err) {
			set({
				error: err instanceof Error ? err.message : "Failed to save API key",
				isLoading: false,
			});
			throw err;
		}
	},

	clearProviderApiKey: async (providerId) => {
		set({ isLoading: true, error: null });
		try {
			await clearCustomProviderApiKey(providerId);
			set({ isLoading: false });
		} catch (err) {
			set({
				error: err instanceof Error ? err.message : "Failed to clear API key",
				isLoading: false,
			});
			throw err;
		}
	},

	loadModels: async (providerId) => {
		try {
			const models = await fetchCustomModels(providerId);
			set((state) => ({
				modelsByProvider: { ...state.modelsByProvider, [providerId]: models },
			}));
		} catch (err) {
			console.error(`Failed to load models for ${providerId}:`, err);
		}
	},

	addModel: async (providerId, model) => {
		set({ isLoading: true, error: null });
		try {
			await createCustomModel(providerId, model);
			await get().loadModels(providerId);
			set({ isLoading: false });
		} catch (err) {
			set({
				error: err instanceof Error ? err.message : "Failed to create model",
				isLoading: false,
			});
			throw err;
		}
	},

	editModel: async (modelId, updates) => {
		set({ isLoading: true, error: null });
		try {
			await updateCustomModel(modelId, updates);
			// Reload all models for the affected provider
			const providerId = modelId.split("/")[0];
			if (providerId) {
				await get().loadModels(providerId);
			}
			set({ isLoading: false });
		} catch (err) {
			set({
				error: err instanceof Error ? err.message : "Failed to update model",
				isLoading: false,
			});
			throw err;
		}
	},

	removeModel: async (modelId, providerId) => {
		set({ isLoading: true, error: null });
		try {
			await deleteCustomModel(modelId);
			await get().loadModels(providerId);
			set({ isLoading: false });
		} catch (err) {
			set({
				error: err instanceof Error ? err.message : "Failed to delete model",
				isLoading: false,
			});
			throw err;
		}
	},
}));
