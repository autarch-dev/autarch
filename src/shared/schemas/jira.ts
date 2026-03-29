import { z } from "zod";
import { WORKFLOW_STATUSES } from "./workflow-status";

// =============================================================================
// Jira Sync Status (shared across milestones, initiatives, workflows)
// =============================================================================

export const JiraSyncStatusSchema = z.enum(["pending", "synced", "error"]);
export type JiraSyncStatus = z.infer<typeof JiraSyncStatusSchema>;

// =============================================================================
// Jira Configuration (stored in project_meta as JSON)
// =============================================================================

// Derived from WorkflowStatusSchema so adding a new workflow status forces
// a corresponding Jira status mapping entry at compile time.
export const JiraStatusMappingSchema = z.object(
	Object.fromEntries(
		WORKFLOW_STATUSES.map((s) => [s, z.string().nullable().default(null)]),
	) as {
		[K in (typeof WORKFLOW_STATUSES)[number]]: z.ZodDefault<
			z.ZodNullable<z.ZodString>
		>;
	},
);
export type JiraStatusMapping = z.infer<typeof JiraStatusMappingSchema>;

// Status mapping for pulse sub-tasks — keyed by Jira issue type ID.
// Maps each pulse execution state to a Jira status ID (null = skip transition).
export const PulseStatusMappingSchema = z.object({
	running: z.string().nullable(),
	succeeded: z.string().nullable(),
	failed: z.string().nullable(),
	stopped: z.string().nullable(),
});
export type PulseStatusMapping = z.infer<typeof PulseStatusMappingSchema>;

export const JiraConfigSchema = z.object({
	enabled: z.boolean(),

	// Connection
	jiraBaseUrl: z.string().url(),
	jiraProjectKey: z.string().min(1),

	// Sync toggles
	syncRoadmaps: z.boolean().default(true),
	syncWorkflows: z.boolean().default(true),
	syncArtifacts: z.boolean().default(true),

	// Status mapping per Autarch object type
	statusMapping: z
		.object({
			milestone: JiraStatusMappingSchema,
			initiative: JiraStatusMappingSchema,
			workflow: JiraStatusMappingSchema,
		})
		.default({
			milestone: {
				backlog: null,
				scoping: null,
				researching: null,
				planning: null,
				in_progress: null,
				review: null,
				done: null,
			},
			initiative: {
				backlog: null,
				scoping: null,
				researching: null,
				planning: null,
				in_progress: null,
				review: null,
				done: null,
			},
			workflow: {
				backlog: null,
				scoping: null,
				researching: null,
				planning: null,
				in_progress: null,
				review: null,
				done: null,
			},
		}),

	// Status mapping for pulse sub-tasks (single mapping, all pulses are Sub-tasks)
	pulseStatusMapping: PulseStatusMappingSchema.default({
		running: null,
		succeeded: null,
		failed: null,
		stopped: null,
	}),

	// Priority mapping
	initiativePriorityMapping: z
		.object({
			low: z.string(),
			medium: z.string(),
			high: z.string(),
			critical: z.string(),
		})
		.default({ low: "", medium: "", high: "", critical: "" }),
	workflowPriorityMapping: z
		.object({
			low: z.string(),
			medium: z.string(),
			high: z.string(),
			urgent: z.string(),
		})
		.default({ low: "", medium: "", high: "", urgent: "" }),
});
export type JiraConfig = z.infer<typeof JiraConfigSchema>;
export type JiraConfigInput = z.input<typeof JiraConfigSchema>;

// =============================================================================
// Jira Credentials (stored in global settings DB)
// =============================================================================

export const JiraCredentialsSchema = z.object({
	email: z.string().email(),
	apiToken: z.string().min(1),
});
export type JiraCredentials = z.infer<typeof JiraCredentialsSchema>;

// =============================================================================
// Jira API Response Types
// =============================================================================

export const JiraIssueTypeSchema = z.object({
	id: z.string(),
	name: z.string(),
	subtask: z.boolean(),
});
export type JiraIssueType = z.infer<typeof JiraIssueTypeSchema>;

export const JiraStatusSchema = z.object({
	id: z.string(),
	name: z.string(),
	statusCategory: z.object({
		key: z.string(),
	}),
});
export type JiraStatus = z.infer<typeof JiraStatusSchema>;

export const JiraPrioritySchema = z.object({
	id: z.string(),
	name: z.string(),
});
export type JiraPriority = z.infer<typeof JiraPrioritySchema>;

export const JiraProjectMetadataSchema = z.object({
	issueTypes: z.array(JiraIssueTypeSchema),
	statuses: z.record(z.string(), z.array(JiraStatusSchema)),
	priorities: z.array(JiraPrioritySchema),
});
export type JiraProjectMetadata = z.infer<typeof JiraProjectMetadataSchema>;

// =============================================================================
// API Request Schemas
// =============================================================================

export const SetJiraConfigRequestSchema = JiraConfigSchema;

export const SetJiraCredentialsRequestSchema = JiraCredentialsSchema;

export const TestJiraConnectionRequestSchema = z.object({
	jiraBaseUrl: z.string().url(),
	jiraProjectKey: z.string().min(1),
	email: z.string().email(),
	apiToken: z.string().min(1),
});
export type TestJiraConnectionRequest = z.infer<
	typeof TestJiraConnectionRequestSchema
>;
