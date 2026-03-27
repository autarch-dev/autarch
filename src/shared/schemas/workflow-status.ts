import { z } from "zod";

// Extracted to its own file to break circular dependency between workflow.ts and jira.ts.
// Both modules need WorkflowStatusSchema — workflow.ts for the full workflow types,
// and jira.ts to derive JiraStatusMappingSchema keys from it.

export const WORKFLOW_STATUSES = [
	"backlog",
	"scoping",
	"researching",
	"planning",
	"in_progress",
	"review",
	"done",
] as const;

export const WorkflowStatusSchema = z.enum(WORKFLOW_STATUSES);
export type WorkflowStatus = z.infer<typeof WorkflowStatusSchema>;
