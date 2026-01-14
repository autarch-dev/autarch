import {
	type AIProvider,
	type ApiKeysResponse,
	ApiKeysResponseSchema,
	type ModelPreferences,
	ModelPreferencesSchema,
	OnboardingStatusResponseSchema,
} from "@/shared/schemas/settings";

/**
 * Check if onboarding has been completed.
 */
export async function fetchOnboardingStatus(): Promise<boolean> {
	const response = await fetch("/api/settings/onboarding");
	const data = await response.json();
	const parsed = OnboardingStatusResponseSchema.parse(data);
	return parsed.complete;
}

/**
 * Mark onboarding as complete.
 */
export async function completeOnboarding(): Promise<void> {
	const response = await fetch("/api/settings/onboarding/complete", {
		method: "POST",
	});
	if (!response.ok) {
		throw new Error("Failed to complete onboarding");
	}
}

/**
 * Get API key configuration status (which providers are configured).
 */
export async function fetchApiKeysStatus(): Promise<ApiKeysResponse> {
	const response = await fetch("/api/settings/api-keys");
	const data = await response.json();
	return ApiKeysResponseSchema.parse(data);
}

/**
 * Set an API key for a provider.
 */
export async function setApiKey(
	provider: AIProvider,
	key: string,
): Promise<void> {
	const response = await fetch("/api/settings/api-keys", {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ provider, key }),
	});
	if (!response.ok) {
		const error = await response.json();
		throw new Error(error.error ?? "Failed to set API key");
	}
}

/**
 * Get current model preferences.
 */
export async function fetchModelPreferences(): Promise<ModelPreferences> {
	const response = await fetch("/api/settings/models");
	const data = await response.json();
	return ModelPreferencesSchema.parse(data);
}

/**
 * Update model preferences.
 */
export async function updateModelPreferences(
	preferences: ModelPreferences,
): Promise<void> {
	const response = await fetch("/api/settings/models", {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(preferences),
	});
	if (!response.ok) {
		const error = await response.json();
		throw new Error(error.error ?? "Failed to update model preferences");
	}
}
