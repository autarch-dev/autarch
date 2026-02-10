import {
	type GitIdentity,
	type GitIdentityDefaults,
	GitIdentityDefaultsSchema,
	GitIdentitySchema,
} from "@/shared/schemas/git-identity";
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
	return parsed.isComplete;
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

/**
 * Get git identity defaults derived from git config.
 */
export async function fetchGitIdentityDefaults(): Promise<GitIdentityDefaults> {
	const response = await fetch("/api/project/git-identity/defaults");
	const data = await response.json();
	return GitIdentityDefaultsSchema.parse(data);
}

/**
 * Get the currently saved git identity.
 */
export async function fetchGitIdentity(): Promise<GitIdentity> {
	const response = await fetch("/api/project/git-identity");
	const data = await response.json();
	return GitIdentitySchema.parse(data);
}

/**
 * Save git identity settings.
 */
export async function saveGitIdentity(identity: GitIdentity): Promise<void> {
	const response = await fetch("/api/project/git-identity", {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(identity),
	});
	if (!response.ok) {
		throw new Error("Failed to save git identity");
	}
}
