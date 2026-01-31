import { z } from "zod";
import {
	type PostWriteHooksConfig,
	PostWriteHooksConfigSchema,
} from "@/shared/schemas/hooks";
import {
	type AIProvider,
	type ApiKeysResponse,
	ApiKeysResponseSchema,
	type IntegrationsStatusResponse,
	IntegrationsStatusResponseSchema,
	type ModelPreferences,
	ModelPreferencesSchema,
} from "@/shared/schemas/settings";

// =============================================================================
// API Keys
// =============================================================================

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
 * Clear an API key for a provider.
 */
export async function clearApiKey(provider: AIProvider): Promise<void> {
	const response = await fetch("/api/settings/api-keys", {
		method: "DELETE",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ provider }),
	});
	if (!response.ok) {
		const error = await response.json();
		throw new Error(error.error ?? "Failed to clear API key");
	}
}

// =============================================================================
// Integrations
// =============================================================================

/**
 * Get integrations configuration status (which integrations are configured).
 */
export async function fetchIntegrationsStatus(): Promise<IntegrationsStatusResponse> {
	const response = await fetch("/api/settings/integrations");
	const data = await response.json();
	return IntegrationsStatusResponseSchema.parse(data);
}

/**
 * Set an integration API key (e.g., Exa).
 */
export async function setIntegrationKey(key: string): Promise<void> {
	const response = await fetch("/api/settings/integrations", {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ key }),
	});
	if (!response.ok) {
		const error = await response.json();
		throw new Error(error.error ?? "Failed to set integration key");
	}
}

/**
 * Clear the integration API key (e.g., Exa).
 */
export async function clearIntegrationKey(): Promise<void> {
	const response = await fetch("/api/settings/integrations", {
		method: "DELETE",
	});
	if (!response.ok) {
		const error = await response.json();
		throw new Error(error.error ?? "Failed to clear integration key");
	}
}

// =============================================================================
// Model Preferences
// =============================================================================

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

// =============================================================================
// Post-Write Hooks
// =============================================================================

/**
 * Get post-write hooks configuration.
 */
export async function fetchHooksConfig(): Promise<PostWriteHooksConfig> {
	const response = await fetch("/api/settings/hooks");
	if (!response.ok) {
		const error = await response.json();
		throw new Error(error.error ?? "Failed to fetch hooks configuration");
	}
	const data = await response.json();
	const parsed = z.object({ hooks: PostWriteHooksConfigSchema }).parse(data);
	return parsed.hooks;
}

/**
 * Update post-write hooks configuration.
 */
export async function updateHooksConfig(
	hooks: PostWriteHooksConfig,
): Promise<void> {
	const response = await fetch("/api/settings/hooks", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ hooks }),
	});
	if (!response.ok) {
		const error = await response.json();
		throw new Error(error.error ?? "Failed to update hooks configuration");
	}
}

// =============================================================================
// Persistent Shell Approvals
// =============================================================================

/**
 * Response type for persistent approvals endpoint.
 */
export interface PersistentApprovalsResponse {
	approvals: string[];
}

/**
 * Get persistent shell approvals for the current project.
 */
export async function fetchPersistentApprovals(): Promise<PersistentApprovalsResponse> {
	const response = await fetch("/api/settings/persistent-approvals");
	if (!response.ok) {
		const error = await response.json();
		throw new Error(error.error ?? "Failed to fetch persistent approvals");
	}
	const data = await response.json();
	return data as PersistentApprovalsResponse;
}

/**
 * Remove a persistent shell approval.
 */
export async function removePersistentApproval(command: string): Promise<void> {
	const response = await fetch("/api/settings/persistent-approvals", {
		method: "DELETE",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ command }),
	});
	if (!response.ok) {
		const error = await response.json();
		throw new Error(error.error ?? "Failed to remove persistent approval");
	}
}
