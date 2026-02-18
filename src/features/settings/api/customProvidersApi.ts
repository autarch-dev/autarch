import {
	type CustomModel,
	CustomModelsListResponseSchema,
	type CustomProvider,
	CustomProvidersListResponseSchema,
} from "@/shared/schemas/custom-providers";

// =============================================================================
// Custom Providers
// =============================================================================

export async function fetchCustomProviders(): Promise<CustomProvider[]> {
	const response = await fetch("/api/settings/custom-providers");
	const data = await response.json();
	return CustomProvidersListResponseSchema.parse(data);
}

export async function createCustomProvider(
	provider: CustomProvider,
): Promise<void> {
	const response = await fetch("/api/settings/custom-providers", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(provider),
	});
	if (!response.ok) {
		const error = await response.json();
		throw new Error(error.error ?? "Failed to create provider");
	}
}

export async function updateCustomProvider(
	id: string,
	updates: Partial<Omit<CustomProvider, "id">>,
): Promise<void> {
	const response = await fetch(
		`/api/settings/custom-providers/${encodeURIComponent(id)}`,
		{
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(updates),
		},
	);
	if (!response.ok) {
		const error = await response.json();
		throw new Error(error.error ?? "Failed to update provider");
	}
}

export async function deleteCustomProvider(id: string): Promise<void> {
	const response = await fetch(
		`/api/settings/custom-providers/${encodeURIComponent(id)}`,
		{ method: "DELETE" },
	);
	if (!response.ok) {
		const error = await response.json();
		throw new Error(error.error ?? "Failed to delete provider");
	}
}

// =============================================================================
// Custom Provider API Keys
// =============================================================================

export async function setCustomProviderApiKey(
	providerId: string,
	key: string,
): Promise<void> {
	const response = await fetch(
		`/api/settings/custom-providers/${encodeURIComponent(providerId)}/api-key`,
		{
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ key }),
		},
	);
	if (!response.ok) {
		const error = await response.json();
		throw new Error(error.error ?? "Failed to set API key");
	}
}

export async function clearCustomProviderApiKey(
	providerId: string,
): Promise<void> {
	const response = await fetch(
		`/api/settings/custom-providers/${encodeURIComponent(providerId)}/api-key`,
		{ method: "DELETE" },
	);
	if (!response.ok) {
		const error = await response.json();
		throw new Error(error.error ?? "Failed to clear API key");
	}
}

// =============================================================================
// Custom Models
// =============================================================================

export async function fetchCustomModels(
	providerId: string,
): Promise<CustomModel[]> {
	const response = await fetch(
		`/api/settings/custom-providers/${encodeURIComponent(providerId)}/models`,
	);
	const data = await response.json();
	return CustomModelsListResponseSchema.parse(data);
}

export async function createCustomModel(
	providerId: string,
	model: Omit<CustomModel, "id" | "providerId">,
): Promise<CustomModel> {
	const response = await fetch(
		`/api/settings/custom-providers/${encodeURIComponent(providerId)}/models`,
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(model),
		},
	);
	if (!response.ok) {
		const error = await response.json();
		throw new Error(error.error ?? "Failed to create model");
	}
	return response.json();
}

export async function updateCustomModel(
	modelId: string,
	updates: Partial<Omit<CustomModel, "id" | "providerId">>,
): Promise<void> {
	const response = await fetch(
		`/api/settings/custom-models/${encodeURIComponent(modelId)}`,
		{
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(updates),
		},
	);
	if (!response.ok) {
		const error = await response.json();
		throw new Error(error.error ?? "Failed to update model");
	}
}

export async function deleteCustomModel(modelId: string): Promise<void> {
	const response = await fetch(
		`/api/settings/custom-models/${encodeURIComponent(modelId)}`,
		{ method: "DELETE" },
	);
	if (!response.ok) {
		const error = await response.json();
		throw new Error(error.error ?? "Failed to delete model");
	}
}
