import { z } from "zod";
import {
	type GitIdentity,
	GitIdentitySchema,
} from "@/shared/schemas/git-identity";
import {
	type PostWriteHooksConfig,
	PostWriteHooksConfigSchema,
} from "@/shared/schemas/hooks";
import {
	type AgentBackend,
	AgentBackend as AgentBackendSchema,
	type AIProvider,
	type ApiKeysResponse,
	ApiKeysResponseSchema,
	type ClaudeCodeModelPreferences,
	ClaudeCodeModelPreferencesSchema,
	type IntegrationsStatusResponse,
	IntegrationsStatusResponseSchema,
	type ModelPreferences,
	ModelPreferencesSchema,
	type ShellApprovalMode,
	ShellApprovalMode as ShellApprovalModeSchema,
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
// Agent Backend
// =============================================================================

/**
 * Get the current agent backend setting.
 */
export async function fetchAgentBackend(): Promise<AgentBackend> {
	const response = await fetch("/api/settings/agent-backend");
	const data = await response.json();
	return AgentBackendSchema.parse(data.backend);
}

/**
 * Update the agent backend setting.
 */
export async function updateAgentBackend(backend: AgentBackend): Promise<void> {
	const response = await fetch("/api/settings/agent-backend", {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ backend }),
	});
	if (!response.ok) {
		const error = await response.json();
		throw new Error(error.error ?? "Failed to update agent backend");
	}
}

// =============================================================================
// Claude Code Model Preferences
// =============================================================================

/**
 * Get Claude Code model preferences.
 */
export async function fetchCcModelPreferences(): Promise<ClaudeCodeModelPreferences> {
	const response = await fetch("/api/settings/cc-models");
	const data = await response.json();
	return ClaudeCodeModelPreferencesSchema.parse(data);
}

/**
 * Update Claude Code model preferences.
 */
export async function updateCcModelPreferences(
	prefs: ClaudeCodeModelPreferences,
): Promise<void> {
	const response = await fetch("/api/settings/cc-models", {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(prefs),
	});
	if (!response.ok) {
		const error = await response.json();
		throw new Error(error.error ?? "Failed to update model preferences");
	}
}

// =============================================================================
// Bedrock Models
// =============================================================================

export interface BedrockModel {
	modelId: string;
	label: string;
	providerName: string;
}

/**
 * Fetch available Bedrock foundation models from AWS.
 * Returns an empty array if credentials are not configured or the call fails.
 */
export async function fetchBedrockModels(): Promise<BedrockModel[]> {
	try {
		const response = await fetch("/api/settings/bedrock/models");
		if (!response.ok) return [];
		return await response.json();
	} catch {
		return [];
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

// =============================================================================
// Sensitive File Gate
// =============================================================================

/**
 * Get whether the sensitive-file gate is disabled for this project.
 */
export async function fetchSensitiveFileGateDisabled(): Promise<boolean> {
	const response = await fetch("/api/settings/sensitive-file-gate");
	if (!response.ok) {
		const error = await response.json();
		throw new Error(error.error ?? "Failed to fetch sensitive file gate");
	}
	const data = await response.json();
	return Boolean(data?.disabled);
}

/**
 * Set whether the sensitive-file gate is disabled for this project.
 */
export async function updateSensitiveFileGateDisabled(
	disabled: boolean,
): Promise<void> {
	const response = await fetch("/api/settings/sensitive-file-gate", {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ disabled }),
	});
	if (!response.ok) {
		const error = await response.json();
		throw new Error(error.error ?? "Failed to update sensitive file gate");
	}
}

// =============================================================================
// Shell Approval Mode
// =============================================================================

/**
 * Get the shell approval mode for this project.
 */
export async function fetchShellApprovalMode(): Promise<ShellApprovalMode> {
	const response = await fetch("/api/settings/shell-approval-mode");
	if (!response.ok) {
		const error = await response.json();
		throw new Error(error.error ?? "Failed to fetch shell approval mode");
	}
	const data = await response.json();
	return ShellApprovalModeSchema.parse(data?.mode);
}

/**
 * Set the shell approval mode for this project.
 */
export async function updateShellApprovalMode(
	mode: ShellApprovalMode,
): Promise<void> {
	const response = await fetch("/api/settings/shell-approval-mode", {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ mode }),
	});
	if (!response.ok) {
		const error = await response.json();
		throw new Error(error.error ?? "Failed to update shell approval mode");
	}
}

// =============================================================================
// Git Identity
// =============================================================================

/**
 * Get the current git author identity for the project.
 */
export async function fetchGitIdentity(): Promise<GitIdentity> {
	const response = await fetch("/api/project/git-identity");
	const data = await response.json();
	return GitIdentitySchema.parse(data);
}

/**
 * Update the git author identity for the project.
 */
export async function updateGitIdentity(identity: GitIdentity): Promise<void> {
	const response = await fetch("/api/project/git-identity", {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(identity),
	});
	if (!response.ok) {
		const error = await response.json();
		throw new Error(error.error ?? "Failed to update git identity");
	}
}
