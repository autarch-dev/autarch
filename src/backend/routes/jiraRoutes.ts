/**
 * Jira Integration API routes.
 *
 * Provides endpoints for:
 * - Jira config CRUD (per-project, stored in project_meta)
 * - Jira credentials CRUD (stored in global settings DB)
 * - Test connection
 * - Fetch project metadata (issue types, statuses, priorities)
 * - Retry failed syncs
 */

import {
	SetJiraConfigRequestSchema,
	SetJiraCredentialsRequestSchema,
	TestJiraConnectionRequestSchema,
} from "@/shared/schemas/jira";
import { log } from "../logger";
import { getProjectRoot } from "../projectRoot";
import {
	clearJiraCredentials,
	getJiraApiToken,
	getJiraEmail,
	isJiraConfigured,
	setJiraCredentials,
} from "../services/globalSettings";
import {
	buildDefaultMappings,
	fetchProjectMetadata,
	testConnection,
} from "../services/jira";
import {
	clearJiraConfig,
	getJiraConfig,
	setJiraConfig,
} from "../services/projectSettings";

export const jiraRoutes = {
	// =========================================================================
	// Jira Configuration
	// =========================================================================

	"/api/settings/jira/config": {
		async GET() {
			try {
				const projectRoot = getProjectRoot();
				const config = await getJiraConfig(projectRoot);
				return Response.json(config ?? { enabled: false });
			} catch (error) {
				log.jira.error("Failed to get Jira config:", error);
				return Response.json(
					{ error: error instanceof Error ? error.message : "Unknown error" },
					{ status: 500 },
				);
			}
		},

		async PUT(req: Request) {
			try {
				const body = await req.json();
				const parsed = SetJiraConfigRequestSchema.safeParse(body);

				if (!parsed.success) {
					return Response.json(
						{ error: "Invalid request", details: parsed.error.flatten() },
						{ status: 400 },
					);
				}

				const projectRoot = getProjectRoot();
				await setJiraConfig(projectRoot, parsed.data);
				return Response.json({ success: true });
			} catch (error) {
				log.jira.error("Failed to save Jira config:", error);
				return Response.json(
					{ error: error instanceof Error ? error.message : "Unknown error" },
					{ status: 500 },
				);
			}
		},

		async DELETE() {
			try {
				const projectRoot = getProjectRoot();
				await clearJiraConfig(projectRoot);
				return Response.json({ success: true });
			} catch (error) {
				log.jira.error("Failed to clear Jira config:", error);
				return Response.json(
					{ error: error instanceof Error ? error.message : "Unknown error" },
					{ status: 500 },
				);
			}
		},
	},

	// =========================================================================
	// Jira Credentials
	// =========================================================================

	"/api/settings/jira/credentials": {
		async GET() {
			try {
				const projectRoot = getProjectRoot();
				const configured = await isJiraConfigured(projectRoot);
				return Response.json({ configured });
			} catch (error) {
				log.jira.error("Failed to get Jira credentials status:", error);
				return Response.json(
					{ error: error instanceof Error ? error.message : "Unknown error" },
					{ status: 500 },
				);
			}
		},

		async PUT(req: Request) {
			try {
				const body = await req.json();
				const parsed = SetJiraCredentialsRequestSchema.safeParse(body);

				if (!parsed.success) {
					return Response.json(
						{ error: "Invalid request", details: parsed.error.flatten() },
						{ status: 400 },
					);
				}

				const projectRoot = getProjectRoot();
				await setJiraCredentials(
					projectRoot,
					parsed.data.email,
					parsed.data.apiToken,
				);
				return Response.json({ success: true });
			} catch (error) {
				log.jira.error("Failed to save Jira credentials:", error);
				return Response.json(
					{ error: error instanceof Error ? error.message : "Unknown error" },
					{ status: 500 },
				);
			}
		},

		async DELETE() {
			try {
				const projectRoot = getProjectRoot();
				await clearJiraCredentials(projectRoot);
				return Response.json({ success: true });
			} catch (error) {
				log.jira.error("Failed to clear Jira credentials:", error);
				return Response.json(
					{ error: error instanceof Error ? error.message : "Unknown error" },
					{ status: 500 },
				);
			}
		},
	},

	// =========================================================================
	// Test Connection
	// =========================================================================

	"/api/settings/jira/test": {
		async POST(req: Request) {
			try {
				const body = await req.json();
				const parsed = TestJiraConnectionRequestSchema.safeParse(body);

				if (!parsed.success) {
					return Response.json(
						{ error: "Invalid request", details: parsed.error.flatten() },
						{ status: 400 },
					);
				}

				const result = await testConnection(
					parsed.data.jiraBaseUrl,
					parsed.data.email,
					parsed.data.apiToken,
					parsed.data.jiraProjectKey,
				);

				return Response.json(result);
			} catch (error) {
				log.jira.error("Failed to test Jira connection:", error);
				return Response.json(
					{ error: error instanceof Error ? error.message : "Unknown error" },
					{ status: 500 },
				);
			}
		},
	},

	// =========================================================================
	// Fetch Project Metadata (issue types, statuses, priorities)
	// =========================================================================

	"/api/settings/jira/metadata": {
		async GET() {
			try {
				const projectRoot = getProjectRoot();
				const config = await getJiraConfig(projectRoot);

				if (!config) {
					return Response.json(
						{ error: "Jira not configured" },
						{ status: 400 },
					);
				}

				const [email, apiToken] = await Promise.all([
					getJiraEmail(projectRoot),
					getJiraApiToken(projectRoot),
				]);

				if (!email || !apiToken) {
					return Response.json(
						{ error: "Jira credentials not configured" },
						{ status: 400 },
					);
				}

				const metadata = await fetchProjectMetadata(
					{ email, apiToken, baseUrl: config.jiraBaseUrl },
					config.jiraProjectKey,
				);

				if (!metadata) {
					return Response.json(
						{ error: "Failed to fetch Jira project metadata" },
						{ status: 502 },
					);
				}

				return Response.json(metadata);
			} catch (error) {
				log.jira.error("Failed to fetch Jira metadata:", error);
				return Response.json(
					{ error: error instanceof Error ? error.message : "Unknown error" },
					{ status: 500 },
				);
			}
		},
	},

	// =========================================================================
	// Bootstrap Default Mappings
	// =========================================================================

	"/api/settings/jira/bootstrap-mappings": {
		async POST() {
			try {
				const projectRoot = getProjectRoot();
				const config = await getJiraConfig(projectRoot);

				if (!config) {
					return Response.json(
						{ error: "Jira not configured" },
						{ status: 400 },
					);
				}

				const [email, apiToken] = await Promise.all([
					getJiraEmail(projectRoot),
					getJiraApiToken(projectRoot),
				]);

				if (!email || !apiToken) {
					return Response.json(
						{ error: "Jira credentials not configured" },
						{ status: 400 },
					);
				}

				const metadata = await fetchProjectMetadata(
					{ email, apiToken, baseUrl: config.jiraBaseUrl },
					config.jiraProjectKey,
				);

				if (!metadata) {
					return Response.json(
						{ error: "Failed to fetch Jira project metadata" },
						{ status: 502 },
					);
				}

				const defaults = buildDefaultMappings(metadata);

				// Reset all mappings to freshly-derived defaults
				const merged = {
					...config,
					statusMapping: defaults.statusMapping,
					initiativePriorityMapping: defaults.initiativePriorityMapping,
					workflowPriorityMapping: defaults.workflowPriorityMapping,
				};

				await setJiraConfig(projectRoot, merged);
				return Response.json({ success: true, config: merged });
			} catch (error) {
				log.jira.error("Failed to bootstrap Jira mappings:", error);
				return Response.json(
					{ error: error instanceof Error ? error.message : "Unknown error" },
					{ status: 500 },
				);
			}
		},
	},
};
