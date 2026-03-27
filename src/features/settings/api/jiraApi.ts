import { z } from "zod";
import type {
	JiraConfig,
	JiraConfigInput,
	JiraCredentials,
	JiraProjectMetadata,
	TestJiraConnectionRequest,
} from "@/shared/schemas/jira";
import {
	JiraConfigSchema,
	JiraProjectMetadataSchema,
} from "@/shared/schemas/jira";

// =============================================================================
// Jira Configuration
// =============================================================================

/**
 * Get the current Jira integration configuration.
 */
export async function fetchJiraConfig(): Promise<JiraConfig | null> {
	const response = await fetch("/api/settings/jira/config");
	if (!response.ok) return null;
	const data = await response.json();
	if (!data.enabled) return null;
	const parsed = JiraConfigSchema.safeParse(data);
	return parsed.success ? parsed.data : null;
}

/**
 * Save the Jira integration configuration.
 */
export async function saveJiraConfig(config: JiraConfigInput): Promise<void> {
	const response = await fetch("/api/settings/jira/config", {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(config),
	});
	if (!response.ok) {
		const error = await response.json();
		throw new Error(error.error ?? "Failed to save Jira configuration");
	}
}

/**
 * Clear the Jira integration configuration.
 */
export async function clearJiraConfig(): Promise<void> {
	const response = await fetch("/api/settings/jira/config", {
		method: "DELETE",
	});
	if (!response.ok) {
		const error = await response.json();
		throw new Error(error.error ?? "Failed to clear Jira configuration");
	}
}

// =============================================================================
// Jira Credentials
// =============================================================================

/**
 * Check if Jira credentials are configured.
 */
const CredentialsStatusSchema = z.object({ configured: z.boolean() });

export async function fetchJiraCredentialsStatus(): Promise<boolean> {
	const response = await fetch("/api/settings/jira/credentials");
	if (!response.ok) return false;
	const data = await response.json();
	const parsed = CredentialsStatusSchema.safeParse(data);
	return parsed.success ? parsed.data.configured : false;
}

/**
 * Save Jira credentials.
 */
export async function saveJiraCredentials(
	credentials: JiraCredentials,
): Promise<void> {
	const response = await fetch("/api/settings/jira/credentials", {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(credentials),
	});
	if (!response.ok) {
		const error = await response.json();
		throw new Error(error.error ?? "Failed to save Jira credentials");
	}
}

/**
 * Clear Jira credentials.
 */
export async function clearJiraCredentials(): Promise<void> {
	const response = await fetch("/api/settings/jira/credentials", {
		method: "DELETE",
	});
	if (!response.ok) {
		const error = await response.json();
		throw new Error(error.error ?? "Failed to clear Jira credentials");
	}
}

// =============================================================================
// Test Connection
// =============================================================================

/**
 * Test the Jira connection with provided credentials.
 */
const TestConnectionResultSchema = z.object({
	success: z.boolean(),
	error: z.string().optional(),
});

export async function testJiraConnection(
	params: TestJiraConnectionRequest,
): Promise<{ success: boolean; error?: string }> {
	const response = await fetch("/api/settings/jira/test", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(params),
	});
	const data = await response.json();
	return TestConnectionResultSchema.parse(data);
}

// =============================================================================
// Metadata
// =============================================================================

/**
 * Fetch Jira project metadata (issue types, statuses, priorities).
 */
export async function fetchJiraMetadata(): Promise<JiraProjectMetadata | null> {
	const response = await fetch("/api/settings/jira/metadata");
	if (!response.ok) return null;
	const data = await response.json();
	const parsed = JiraProjectMetadataSchema.safeParse(data);
	return parsed.success ? parsed.data : null;
}

// =============================================================================
// Bootstrap Mappings
// =============================================================================

/**
 * Bootstrap default status/priority mappings from Jira project metadata.
 * Returns the updated config with populated mappings.
 */
export async function bootstrapJiraMappings(): Promise<JiraConfig | null> {
	const response = await fetch("/api/settings/jira/bootstrap-mappings", {
		method: "POST",
	});
	if (!response.ok) return null;
	const data = await response.json();
	if (!data.config) return null;
	const parsed = JiraConfigSchema.safeParse(data.config);
	return parsed.success ? parsed.data : null;
}
