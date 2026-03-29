/**
 * Jira Integration Service
 *
 * Handles all outbound communication with Jira Cloud REST API v3.
 * One-way sync: Autarch → Jira. Autarch is the source of truth.
 *
 * Provides:
 * - Authentication (API token)
 * - Issue CRUD (create/update epics, stories, tasks, sub-tasks)
 * - Status transitions
 * - Comment posting (ADF-formatted artifacts)
 * - Issue linking (dependencies)
 * - Project metadata fetching (issue types, statuses, priorities)
 * - Retry with exponential backoff for transient errors
 */

import type {
	JiraConfig,
	JiraProjectMetadata,
	JiraSyncStatus,
} from "@/shared/schemas/jira";
import type { Initiative, Milestone } from "@/shared/schemas/roadmap";
import type {
	Plan,
	ResearchCard,
	ReviewCard,
	ScopeCard,
	Workflow,
	WorkflowStatus,
} from "@/shared/schemas/workflow";
import { getProjectDb } from "../db/project";
import { log } from "../logger";
import { getProjectRoot } from "../projectRoot";
import { getRepositories } from "../repositories";
import { getJiraApiToken, getJiraEmail } from "./globalSettings";
import { getJiraConfig } from "./projectSettings";

// =============================================================================
// Types
// =============================================================================

export interface JiraAuth {
	email: string;
	apiToken: string;
	baseUrl: string;
}

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

type JiraApiResult<T> =
	| { ok: true; status: number; data: T }
	| { ok: false; status: number; error: unknown };

interface JiraIssueResponse {
	id: string;
	key: string;
	self: string;
}

interface JiraTransition {
	id: string;
	name: string;
	to: {
		id: string;
		name: string;
	};
}

// =============================================================================
// Constants
// =============================================================================

const MAX_RETRIES = 3;
const RETRY_BASE_MS = 1000;
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

// =============================================================================
// HTTP Client with Retry
// =============================================================================

function authHeaders(auth: JiraAuth, hasBody: boolean): Record<string, string> {
	const encoded = Buffer.from(`${auth.email}:${auth.apiToken}`).toString(
		"base64",
	);
	const headers: Record<string, string> = {
		Authorization: `Basic ${encoded}`,
		Accept: "application/json",
	};
	if (hasBody) {
		headers["Content-Type"] = "application/json";
	}
	return headers;
}

async function jiraFetch<T = unknown>(
	auth: JiraAuth,
	method: HttpMethod,
	path: string,
	body?: unknown,
): Promise<JiraApiResult<T>> {
	const url = `${auth.baseUrl}/rest/api/3${path}`;

	for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
		try {
			const response = await fetch(url, {
				method,
				headers: authHeaders(auth, !!body),
				body: body ? JSON.stringify(body) : undefined,
			});

			// HTTP 204 No Content — no body to parse (Jira returns this for PUT, transitions)
			if (response.status === 204) {
				return { ok: true, status: 204, data: undefined as unknown as T };
			}

			const isJson = response.headers
				.get("content-type")
				?.includes("application/json");
			const data = isJson ? await response.json() : await response.text();

			if (response.ok) {
				return { ok: true, status: response.status, data: data as T };
			}

			// Retryable?
			if (
				RETRYABLE_STATUS_CODES.has(response.status) &&
				attempt < MAX_RETRIES
			) {
				const delay = RETRY_BASE_MS * 2 ** attempt;
				log.jira.warn(
					`Retryable error ${response.status} on ${method} ${path}, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`,
				);
				await new Promise((r) => setTimeout(r, delay));
				continue;
			}

			// Non-retryable error
			const errorMsg =
				typeof data === "object" && data !== null
					? JSON.stringify(data)
					: String(data);
			log.jira.error(
				`Jira API error ${response.status} on ${method} ${path}: ${errorMsg}`,
			);
			return { ok: false, status: response.status, error: data };
		} catch (error) {
			if (attempt < MAX_RETRIES) {
				const delay = RETRY_BASE_MS * 2 ** attempt;
				log.jira.warn(
					`Network error on ${method} ${path}, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES}): ${error}`,
				);
				await new Promise((r) => setTimeout(r, delay));
				continue;
			}
			log.jira.error(`Jira API network error on ${method} ${path}: ${error}`);
			return { ok: false, status: 0, error };
		}
	}

	// Should not reach here, but TypeScript needs it
	return { ok: false, status: 0, error: "Max retries exhausted" };
}

// =============================================================================
// Auth Resolution
// =============================================================================

async function resolveConfigAndAuth(): Promise<{
	config: JiraConfig;
	auth: JiraAuth;
} | null> {
	const projectRoot = getProjectRoot();
	const config = await getJiraConfig(projectRoot);
	if (!config?.enabled) return null;

	const [email, apiToken] = await Promise.all([
		getJiraEmail(projectRoot),
		getJiraApiToken(projectRoot),
	]);

	if (!email || !apiToken) {
		log.jira.warn("Jira credentials not configured");
		return null;
	}

	return { config, auth: { email, apiToken, baseUrl: config.jiraBaseUrl } };
}

async function resolveAuth(): Promise<JiraAuth | null> {
	const ctx = await resolveConfigAndAuth();
	return ctx?.auth ?? null;
}

// =============================================================================
// Jira Sync Status Updates (DB)
// =============================================================================

type SyncableTable = "milestones" | "initiatives" | "workflows";

interface SyncStatusUpdate {
	entityId: string;
	status: JiraSyncStatus;
	jiraKey?: string;
	jiraId?: string;
	error?: string;
}

// Column names for the Jira key/id fields differ by table
const SYNC_KEY_COLUMNS: Record<SyncableTable, { key: string; id: string }> = {
	milestones: { key: "jira_epic_key", id: "jira_epic_id" },
	initiatives: { key: "jira_issue_key", id: "jira_issue_id" },
	workflows: { key: "jira_issue_key", id: "jira_issue_id" },
};

async function updateSyncStatus(
	table: SyncableTable,
	update: SyncStatusUpdate,
): Promise<void> {
	const projectRoot = getProjectRoot();
	const db = await getProjectDb(projectRoot);
	const cols = SYNC_KEY_COLUMNS[table];
	await db
		.updateTable(table)
		.set({
			jira_sync_status: update.status,
			// undefined = skip update in Kysely — preserves last successful sync time on pending/error
			jira_synced_at: update.status === "synced" ? Date.now() : undefined,
			jira_sync_error:
				update.status === "error" ? (update.error ?? null) : null,
			...(update.jiraKey !== undefined ? { [cols.key]: update.jiraKey } : {}),
			...(update.jiraId !== undefined ? { [cols.id]: update.jiraId } : {}),
		})
		.where("id", "=", update.entityId)
		.execute();
}

function updateMilestoneSyncStatus(
	milestoneId: string,
	status: JiraSyncStatus,
	jiraKey?: string,
	jiraId?: string,
	error?: string,
): Promise<void> {
	return updateSyncStatus("milestones", {
		entityId: milestoneId,
		status,
		jiraKey,
		jiraId,
		error,
	});
}

function updateInitiativeSyncStatus(
	initiativeId: string,
	status: JiraSyncStatus,
	jiraKey?: string,
	jiraId?: string,
	error?: string,
): Promise<void> {
	return updateSyncStatus("initiatives", {
		entityId: initiativeId,
		status,
		jiraKey,
		jiraId,
		error,
	});
}

function updateWorkflowSyncStatus(
	workflowId: string,
	status: JiraSyncStatus,
	jiraKey?: string,
	jiraId?: string,
	error?: string,
): Promise<void> {
	return updateSyncStatus("workflows", {
		entityId: workflowId,
		status,
		jiraKey,
		jiraId,
		error,
	});
}

// =============================================================================
// ADF (Atlassian Document Format) Helpers
// =============================================================================

interface AdfNode {
	type: string;
	text?: string;
	attrs?: Record<string, unknown>;
	content?: AdfNode[];
}

interface AdfDocument {
	version: 1;
	type: "doc";
	content: AdfNode[];
}

function textNode(text: string): AdfNode {
	return { type: "text", text };
}

function heading(text: string, level = 2): AdfNode {
	return {
		type: "heading",
		attrs: { level },
		content: [textNode(text)],
	};
}

function paragraph(text: string): AdfNode {
	return {
		type: "paragraph",
		content: [textNode(text)],
	};
}

function bulletList(items: string[]): AdfNode {
	return {
		type: "bulletList",
		content: items.map((item) => ({
			type: "listItem",
			content: [paragraph(item)],
		})),
	};
}

function adfDocument(content: AdfNode[]): AdfDocument {
	return {
		version: 1,
		type: "doc",
		content,
	};
}

function scopeCardToAdf(card: ScopeCard): AdfDocument {
	const content: AdfNode[] = [
		heading(`Scope Card: ${card.title}`),
		paragraph(card.description),
	];

	if (card.inScope.length > 0) {
		content.push(heading("In Scope", 3));
		content.push(bulletList(card.inScope));
	}

	if (card.outOfScope.length > 0) {
		content.push(heading("Out of Scope", 3));
		content.push(bulletList(card.outOfScope));
	}

	if (card.constraints && card.constraints.length > 0) {
		content.push(heading("Constraints", 3));
		content.push(bulletList(card.constraints));
	}

	if (card.rationale) {
		content.push(heading("Rationale", 3));
		content.push(paragraph(card.rationale));
	}

	content.push(paragraph(`Recommended path: ${card.recommendedPath}`));

	return adfDocument(content);
}

function researchCardToAdf(card: ResearchCard): AdfDocument {
	const content: AdfNode[] = [
		heading("Research Findings"),
		paragraph(card.summary),
	];

	if (card.keyFiles.length > 0) {
		content.push(heading("Key Files", 3));
		content.push(
			bulletList(card.keyFiles.map((f) => `${f.path} — ${f.purpose}`)),
		);
	}

	if (card.recommendations.length > 0) {
		content.push(heading("Recommendations", 3));
		content.push(bulletList(card.recommendations));
	}

	if (card.challenges && card.challenges.length > 0) {
		content.push(heading("Challenges", 3));
		content.push(
			bulletList(card.challenges.map((c) => `${c.issue}: ${c.mitigation}`)),
		);
	}

	return adfDocument(content);
}

function planToAdf(plan: Plan): AdfDocument {
	const content: AdfNode[] = [
		heading("Implementation Plan"),
		paragraph(plan.approachSummary),
	];

	return adfDocument(content);
}

function reviewCardToAdf(card: ReviewCard): AdfDocument {
	const content: AdfNode[] = [heading("Review Summary")];

	if (card.summary) {
		content.push(paragraph(card.summary));
	}

	if (card.recommendation) {
		content.push(paragraph(`Recommendation: ${card.recommendation}`));
	}

	if (card.comments.length > 0) {
		content.push(heading("Review Comments", 3));
		content.push(
			bulletList(
				card.comments.map((c) => {
					const prefix = c.filePath
						? `[${c.filePath}${c.startLine ? `:${c.startLine}` : ""}] `
						: "";
					return `${prefix}${c.description}`;
				}),
			),
		);
	}

	return adfDocument(content);
}

// =============================================================================
// Issue CRUD
// =============================================================================

async function createIssue(
	auth: JiraAuth,
	projectKey: string,
	issueTypeId: string,
	summary: string,
	description?: string,
	parentKey?: string,
	priorityId?: string,
): Promise<JiraIssueResponse | null> {
	const fields: Record<string, unknown> = {
		project: { key: projectKey },
		issuetype: { id: issueTypeId },
		summary,
	};

	if (description) {
		fields.description = adfDocument([paragraph(description)]);
	}

	if (parentKey) {
		fields.parent = { key: parentKey };
	}

	if (priorityId) {
		fields.priority = { id: priorityId };
	}

	const result = await jiraFetch<JiraIssueResponse>(auth, "POST", "/issue", {
		fields,
	});

	if (!result.ok) {
		return null;
	}

	return result.data;
}

async function updateIssue(
	auth: JiraAuth,
	issueKey: string,
	fields: Record<string, unknown>,
): Promise<boolean> {
	const result = await jiraFetch(auth, "PUT", `/issue/${issueKey}`, {
		fields,
	});
	return result.ok;
}

async function getCurrentUserAccountId(auth: JiraAuth): Promise<string | null> {
	const result = await jiraFetch<{ accountId: string }>(auth, "GET", "/myself");
	return result.ok ? result.data.accountId : null;
}

async function transitionIssue(
	auth: JiraAuth,
	issueKey: string,
	targetStatusId: string,
): Promise<boolean> {
	// First get available transitions
	const transResult = await jiraFetch<{ transitions: JiraTransition[] }>(
		auth,
		"GET",
		`/issue/${issueKey}/transitions`,
	);

	if (!transResult.ok) return false;

	// Find the transition that leads to target status
	const transition = transResult.data.transitions.find(
		(t) => t.to.id === targetStatusId,
	);

	if (!transition) {
		log.jira.warn(
			`No transition found to status ${targetStatusId} for issue ${issueKey}`,
		);
		return false;
	}

	const result = await jiraFetch(
		auth,
		"POST",
		`/issue/${issueKey}/transitions`,
		{
			transition: { id: transition.id },
		},
	);

	return result.ok;
}

async function addComment(
	auth: JiraAuth,
	issueKey: string,
	adfBody: AdfDocument,
): Promise<boolean> {
	const result = await jiraFetch(auth, "POST", `/issue/${issueKey}/comment`, {
		body: adfBody,
	});
	return result.ok;
}

async function createIssueLink(
	auth: JiraAuth,
	inwardIssueKey: string,
	outwardIssueKey: string,
	linkType = "Blocks",
): Promise<boolean> {
	const result = await jiraFetch(auth, "POST", "/issueLink", {
		type: { name: linkType },
		inwardIssue: { key: inwardIssueKey },
		outwardIssue: { key: outwardIssueKey },
	});
	return result.ok;
}

// =============================================================================
// Project Metadata
// =============================================================================

export async function fetchProjectMetadata(
	auth: JiraAuth,
	projectKey: string,
): Promise<JiraProjectMetadata | null> {
	// Fetch issue types
	const typesResult = await jiraFetch<{
		issueTypes: Array<{ id: string; name: string; subtask: boolean }>;
	}>(auth, "GET", `/project/${projectKey}`);

	if (!typesResult.ok) return null;

	const issueTypes = (typesResult.data.issueTypes ?? []).map((t) => ({
		id: t.id,
		name: t.name,
		subtask: t.subtask,
	}));

	// Fetch statuses per issue type
	const statusResult = await jiraFetch<
		Array<{
			id: string;
			statuses: Array<{
				id: string;
				name: string;
				statusCategory: { key: string };
			}>;
		}>
	>(auth, "GET", `/project/${projectKey}/statuses`);

	const statuses: Record<
		string,
		Array<{ id: string; name: string; statusCategory: { key: string } }>
	> = {};
	if (statusResult.ok) {
		for (const issueType of statusResult.data) {
			statuses[issueType.id] = issueType.statuses;
		}
	}

	// Fetch priorities
	const priorityResult = await jiraFetch<Array<{ id: string; name: string }>>(
		auth,
		"GET",
		"/priority",
	);

	const priorities = priorityResult.ok
		? priorityResult.data.map((p) => ({ id: p.id, name: p.name }))
		: [];

	return { issueTypes, statuses, priorities };
}

/**
 * Build sensible default status and priority mappings from Jira project metadata.
 *
 * Status mapping strategy (per issue type):
 * - Jira statuses have a statusCategory.key: "new", "indeterminate", or "done".
 * - "new" category  → backlog, scoping
 * - "indeterminate"  → researching, planning, in_progress, review
 * - "done"           → done
 * - Within each bucket we pick the first status (Jira returns them in project order).
 *
 * Priority mapping: match by conventional name ("Lowest"/"Low" → low, etc.).
 */
export function buildDefaultMappings(meta: JiraProjectMetadata): {
	statusMapping: JiraConfig["statusMapping"];
	pulseStatusMapping: JiraConfig["pulseStatusMapping"];
	initiativePriorityMapping: JiraConfig["initiativePriorityMapping"];
	workflowPriorityMapping: JiraConfig["workflowPriorityMapping"];
} {
	// Helper: build a JiraStatusMapping from a given Jira issue type ID
	const buildStatusMapping = (
		typeId: string,
	): JiraConfig["statusMapping"]["workflow"] => {
		const typeStatuses = meta.statuses[typeId] ?? [];
		const byCategory: Record<string, string> = {};
		for (const s of typeStatuses) {
			if (!byCategory[s.statusCategory.key]) {
				byCategory[s.statusCategory.key] = s.id;
			}
		}
		const doneStatus =
			[...typeStatuses].reverse().find((s) => s.statusCategory.key === "done")
				?.id ?? null;
		const newId = byCategory.new ?? null;
		const inProgressId = byCategory.indeterminate ?? null;
		return {
			backlog: newId,
			scoping: newId,
			researching: inProgressId,
			planning: inProgressId,
			in_progress: inProgressId,
			review: inProgressId,
			done: doneStatus,
		};
	};

	const nullStatusMapping: JiraConfig["statusMapping"]["workflow"] = {
		backlog: null,
		scoping: null,
		researching: null,
		planning: null,
		in_progress: null,
		review: null,
		done: null,
	};

	// Find the Jira type IDs for the Autarch objects we care about
	const epicTypeId = meta.issueTypes.find(
		(t) => t.name === "Epic" && !t.subtask,
	)?.id;
	const storyTypeId = meta.issueTypes.find(
		(t) => t.name === "Story" && !t.subtask,
	)?.id;
	const subtaskTypeId = meta.issueTypes.find((t) => t.subtask)?.id;

	const statusMapping: JiraConfig["statusMapping"] = {
		milestone: epicTypeId ? buildStatusMapping(epicTypeId) : nullStatusMapping,
		initiative: storyTypeId
			? buildStatusMapping(storyTypeId)
			: nullStatusMapping,
		workflow: storyTypeId ? buildStatusMapping(storyTypeId) : nullStatusMapping,
	};

	// Pulse sub-task mapping (single, all pulses share the same Sub-task type)
	let pulseStatusMapping: JiraConfig["pulseStatusMapping"] = {
		running: null,
		succeeded: null,
		failed: null,
		stopped: null,
	};
	if (subtaskTypeId) {
		const typeStatuses = meta.statuses[subtaskTypeId] ?? [];
		const byCategory: Record<string, string> = {};
		for (const s of typeStatuses) {
			if (!byCategory[s.statusCategory.key])
				byCategory[s.statusCategory.key] = s.id;
		}
		const doneStatus =
			[...typeStatuses].reverse().find((s) => s.statusCategory.key === "done")
				?.id ?? null;
		pulseStatusMapping = {
			running: byCategory.indeterminate ?? null,
			succeeded: doneStatus,
			failed: null,
			stopped: null,
		};
	}

	// --- Priority mapping ---
	const priorityByName: Record<string, string> = {};
	for (const p of meta.priorities) {
		priorityByName[p.name.toLowerCase()] = p.id;
	}

	const findPriority = (...names: string[]): string => {
		for (const n of names) {
			if (priorityByName[n]) return priorityByName[n];
		}
		return meta.priorities[0]?.id ?? "";
	};

	const initiativePriorityMapping = {
		low: findPriority("low", "lowest"),
		medium: findPriority("medium"),
		high: findPriority("high"),
		critical: findPriority("highest", "critical", "blocker"),
	};

	const workflowPriorityMapping = {
		low: findPriority("low", "lowest"),
		medium: findPriority("medium"),
		high: findPriority("high"),
		urgent: findPriority("highest", "critical", "blocker"),
	};

	return {
		statusMapping,
		pulseStatusMapping,
		initiativePriorityMapping,
		workflowPriorityMapping,
	};
}

export async function testConnection(
	baseUrl: string,
	email: string,
	apiToken: string,
	projectKey: string,
): Promise<{ success: boolean; error?: string }> {
	const auth: JiraAuth = { email, apiToken, baseUrl };
	const result = await jiraFetch(auth, "GET", `/project/${projectKey}`);

	if (result.ok) {
		return { success: true };
	}

	if (result.status === 401 || result.status === 403) {
		return {
			success: false,
			error: "Authentication failed. Check your email and API token.",
		};
	}

	if (result.status === 404) {
		return { success: false, error: `Project '${projectKey}' not found.` };
	}

	return {
		success: false,
		error: `Jira API returned ${result.status}`,
	};
}

// =============================================================================
// Project Metadata Cache
// =============================================================================

const METADATA_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let metadataCache: {
	key: string;
	data: JiraProjectMetadata;
	expiresAt: number;
} | null = null;

async function getCachedMetadata(
	auth: JiraAuth,
	projectKey: string,
): Promise<JiraProjectMetadata | null> {
	const cacheKey = `${auth.baseUrl}:${projectKey}`;
	if (
		metadataCache &&
		metadataCache.key === cacheKey &&
		Date.now() < metadataCache.expiresAt
	) {
		return metadataCache.data;
	}
	const meta = await fetchProjectMetadata(auth, projectKey);
	if (meta) {
		metadataCache = {
			key: cacheKey,
			data: meta,
			expiresAt: Date.now() + METADATA_CACHE_TTL_MS,
		};
	}
	return meta;
}

// =============================================================================
// High-Level Sync Operations
// =============================================================================

/**
 * Find the Jira issue type ID by name (e.g., "Epic", "Story", "Task", "Sub-task").
 * Uses cached project metadata to avoid repeated API calls.
 */
async function findIssueTypeId(
	auth: JiraAuth,
	projectKey: string,
	name: string,
): Promise<string | null> {
	const meta = await getCachedMetadata(auth, projectKey);
	if (!meta) return null;

	const match = meta.issueTypes.find(
		(t) => t.name.toLowerCase() === name.toLowerCase(),
	);
	return match?.id ?? null;
}

/**
 * Sync a Milestone → Jira Epic
 * Creates or updates the Epic in Jira.
 */
export async function syncMilestone(milestone: Milestone): Promise<void> {
	const ctx = await resolveConfigAndAuth();
	if (!ctx || !ctx.config.syncRoadmaps) return;

	const { config, auth } = ctx;

	await updateMilestoneSyncStatus(milestone.id, "pending");

	try {
		if (milestone.jiraEpicKey) {
			// Update existing
			const success = await updateIssue(auth, milestone.jiraEpicKey, {
				summary: milestone.title,
				...(milestone.description
					? {
							description: adfDocument([paragraph(milestone.description)]),
						}
					: {}),
			});

			if (success) {
				await updateMilestoneSyncStatus(milestone.id, "synced");
				log.jira.info(
					`Updated Epic ${milestone.jiraEpicKey} for milestone ${milestone.id}`,
				);
			} else {
				await updateMilestoneSyncStatus(
					milestone.id,
					"error",
					undefined,
					undefined,
					"Failed to update Jira Epic",
				);
			}
		} else {
			// Create new
			const epicTypeId = await findIssueTypeId(
				auth,
				config.jiraProjectKey,
				"Epic",
			);
			if (!epicTypeId) {
				await updateMilestoneSyncStatus(
					milestone.id,
					"error",
					undefined,
					undefined,
					"Epic issue type not found in Jira project",
				);
				return;
			}

			const issue = await createIssue(
				auth,
				config.jiraProjectKey,
				epicTypeId,
				milestone.title,
				milestone.description,
			);

			if (issue) {
				await updateMilestoneSyncStatus(
					milestone.id,
					"synced",
					issue.key,
					issue.id,
				);
				log.jira.info(
					`Created Epic ${issue.key} for milestone ${milestone.id}`,
				);
			} else {
				await updateMilestoneSyncStatus(
					milestone.id,
					"error",
					undefined,
					undefined,
					"Failed to create Jira Epic",
				);
			}
		}
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);
		await updateMilestoneSyncStatus(
			milestone.id,
			"error",
			undefined,
			undefined,
			msg,
		);
		log.jira.error(`Error syncing milestone ${milestone.id}: ${msg}`);
	}
}

/**
 * Sync an Initiative → Jira Story
 * Creates or updates the Story in Jira, linked under the milestone's Epic.
 */
export async function syncInitiative(
	initiative: Initiative,
	parentEpicKey?: string,
): Promise<void> {
	const ctx = await resolveConfigAndAuth();
	if (!ctx || !ctx.config.syncRoadmaps) return;

	const { config, auth } = ctx;

	await updateInitiativeSyncStatus(initiative.id, "pending");

	const priorityId =
		config.initiativePriorityMapping[initiative.priority] ?? undefined;

	try {
		if (initiative.jiraIssueKey) {
			// Update existing
			const fields: Record<string, unknown> = {
				summary: initiative.title,
			};
			if (initiative.description) {
				fields.description = adfDocument([paragraph(initiative.description)]);
			}
			if (priorityId) {
				fields.priority = { id: priorityId };
			}

			const success = await updateIssue(auth, initiative.jiraIssueKey, fields);

			if (success) {
				await updateInitiativeSyncStatus(initiative.id, "synced");
				log.jira.info(
					`Updated Story ${initiative.jiraIssueKey} for initiative ${initiative.id}`,
				);
			} else {
				await updateInitiativeSyncStatus(
					initiative.id,
					"error",
					undefined,
					undefined,
					"Failed to update Jira Story",
				);
			}
		} else {
			// Create new
			const storyTypeId = await findIssueTypeId(
				auth,
				config.jiraProjectKey,
				"Story",
			);
			if (!storyTypeId) {
				await updateInitiativeSyncStatus(
					initiative.id,
					"error",
					undefined,
					undefined,
					"Story issue type not found in Jira project",
				);
				return;
			}

			const issue = await createIssue(
				auth,
				config.jiraProjectKey,
				storyTypeId,
				initiative.title,
				initiative.description,
				parentEpicKey,
				priorityId,
			);

			if (issue) {
				await updateInitiativeSyncStatus(
					initiative.id,
					"synced",
					issue.key,
					issue.id,
				);
				log.jira.info(
					`Created Story ${issue.key} for initiative ${initiative.id}`,
				);
			} else {
				await updateInitiativeSyncStatus(
					initiative.id,
					"error",
					undefined,
					undefined,
					"Failed to create Jira Story",
				);
			}
		}
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);
		await updateInitiativeSyncStatus(
			initiative.id,
			"error",
			undefined,
			undefined,
			msg,
		);
		log.jira.error(`Error syncing initiative ${initiative.id}: ${msg}`);
	}
}

/**
 * Sync a Workflow → Jira Story.
 * If the workflow is linked to an initiative that already has a Jira issue,
 * the workflow is associated with that existing Story instead of creating a new one.
 * Otherwise creates a new Story in Jira.
 */
export async function syncWorkflow(
	workflow: Workflow,
	initiativeJira?: { key: string; id?: string },
): Promise<void> {
	const ctx = await resolveConfigAndAuth();
	if (!ctx || !ctx.config.syncWorkflows) return;

	const { config, auth } = ctx;

	await updateWorkflowSyncStatus(workflow.id, "pending");

	const priorityId =
		config.workflowPriorityMapping[workflow.priority] ?? undefined;

	try {
		if (initiativeJira) {
			// Always adopt the initiative's Jira Story as the workflow's issue,
			// even if the workflow already has a different key (race where sync
			// ran before the initiative link was established).
			if (workflow.jiraIssueKey !== initiativeJira.key) {
				await updateWorkflowSyncStatus(
					workflow.id,
					"synced",
					initiativeJira.key,
					initiativeJira.id,
				);
				log.jira.info(
					`Linked workflow ${workflow.id} to initiative Story ${initiativeJira.key}`,
				);
			} else {
				await updateWorkflowSyncStatus(workflow.id, "synced");
			}
		} else if (workflow.jiraIssueKey) {
			// Standalone workflow — update existing Story
			const fields: Record<string, unknown> = {
				summary: workflow.title,
			};
			if (workflow.description) {
				fields.description = adfDocument([paragraph(workflow.description)]);
			}
			if (priorityId) {
				fields.priority = { id: priorityId };
			}

			const success = await updateIssue(auth, workflow.jiraIssueKey, fields);

			if (success) {
				await updateWorkflowSyncStatus(workflow.id, "synced");
				log.jira.info(
					`Updated Story ${workflow.jiraIssueKey} for workflow ${workflow.id}`,
				);
			} else {
				await updateWorkflowSyncStatus(
					workflow.id,
					"error",
					undefined,
					undefined,
					"Failed to update Jira Story",
				);
			}
		} else {
			// Standalone workflow — create a new Story
			const storyTypeId = await findIssueTypeId(
				auth,
				config.jiraProjectKey,
				"Story",
			);
			if (!storyTypeId) {
				await updateWorkflowSyncStatus(
					workflow.id,
					"error",
					undefined,
					undefined,
					"Story issue type not found in Jira project",
				);
				return;
			}

			const issue = await createIssue(
				auth,
				config.jiraProjectKey,
				storyTypeId,
				workflow.title,
				workflow.description,
				undefined,
				priorityId,
			);

			if (issue) {
				await updateWorkflowSyncStatus(
					workflow.id,
					"synced",
					issue.key,
					issue.id,
				);
				log.jira.info(`Created Story ${issue.key} for workflow ${workflow.id}`);
			} else {
				await updateWorkflowSyncStatus(
					workflow.id,
					"error",
					undefined,
					undefined,
					"Failed to create Jira Story",
				);
			}
		}
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);
		await updateWorkflowSyncStatus(
			workflow.id,
			"error",
			undefined,
			undefined,
			msg,
		);
		log.jira.error(`Error syncing workflow ${workflow.id}: ${msg}`);
	}
}

/**
 * Push a workflow status transition to its Jira Task.
 * Reads the jiraIssueKey fresh from DB to avoid stale in-memory references
 * (the key may have been written by a concurrent fire-and-forget syncWorkflow).
 */
export async function syncWorkflowStatus(
	workflowId: string,
	newStatus: WorkflowStatus,
): Promise<void> {
	const ctx = await resolveConfigAndAuth();
	if (!ctx || !ctx.config.syncWorkflows) return;

	const { config, auth } = ctx;

	// Read the fresh jira_issue_key from DB to avoid race with syncWorkflow
	const projectRoot = getProjectRoot();
	const db = await getProjectDb(projectRoot);
	const row = await db
		.selectFrom("workflows")
		.select(["jira_issue_key"])
		.where("id", "=", workflowId)
		.executeTakeFirst();

	const issueKey = row?.jira_issue_key;
	if (!issueKey) {
		log.jira.warn(
			`Workflow ${workflowId} has no Jira issue key, skipping status sync`,
		);
		return;
	}

	// Find the target Jira status ID from the workflow status mapping
	const mapping = config.statusMapping.workflow;
	if (!mapping) {
		log.jira.warn(`No workflow status mapping configured`);
		return;
	}

	const targetStatusId = mapping[newStatus];
	if (!targetStatusId) {
		log.jira.info(
			`Status ${newStatus} mapped to null (skip) for workflow ${workflowId}`,
		);
		return;
	}

	try {
		const success = await transitionIssue(auth, issueKey, targetStatusId);
		if (success) {
			log.jira.info(
				`Transitioned ${issueKey} to status ${targetStatusId} for workflow ${workflowId}`,
			);
		} else {
			log.jira.warn(
				`Failed to transition ${issueKey} to status ${targetStatusId}`,
			);
		}
	} catch (error) {
		log.jira.error(
			`Error transitioning ${issueKey}: ${error instanceof Error ? error.message : error}`,
		);
	}

	// When a workflow starts, assign the issue to the authenticated user
	if (newStatus === "in_progress") {
		try {
			const accountId = await getCurrentUserAccountId(auth);
			if (accountId) {
				await updateIssue(auth, issueKey, { assignee: { accountId } });
				log.jira.info(`Assigned ${issueKey} to user ${accountId}`);
			}
		} catch (error) {
			log.jira.warn(
				`Failed to assign ${issueKey}: ${error instanceof Error ? error.message : error}`,
			);
		}
	}
}

/**
 * Transition a Jira issue to "done" status (used for delete handling).
 * @param autarchType - The Autarch object type ("milestone" | "initiative" | "workflow")
 */
export async function transitionIssueToDone(
	issueKey: string,
	autarchType: "milestone" | "initiative" | "workflow",
): Promise<void> {
	const ctx = await resolveConfigAndAuth();
	if (!ctx) return;

	const { config, auth } = ctx;

	const mapping = config.statusMapping[autarchType];
	if (!mapping?.done) {
		log.jira.warn(
			`No "done" status mapping for ${autarchType} to close ${issueKey}`,
		);
		return;
	}

	const success = await transitionIssue(auth, issueKey, mapping.done);
	if (success) {
		log.jira.info(`Transitioned ${issueKey} to done`);
	}
}

/**
 * Sync a dependency as a Jira issue link.
 */
export async function syncDependency(
	sourceIssueKey: string,
	targetIssueKey: string,
): Promise<void> {
	const auth = await resolveAuth();
	if (!auth) return;

	const success = await createIssueLink(auth, sourceIssueKey, targetIssueKey);

	if (success) {
		log.jira.info(
			`Created issue link: ${sourceIssueKey} blocks ${targetIssueKey}`,
		);
	} else {
		log.jira.warn(
			`Failed to create issue link: ${sourceIssueKey} → ${targetIssueKey}`,
		);
	}
}

/**
 * Push an artifact as an ADF-formatted comment on a Jira issue.
 */
type ArtifactEntry =
	| { type: "scope_card"; artifact: ScopeCard }
	| { type: "research"; artifact: ResearchCard }
	| { type: "plan"; artifact: Plan }
	| { type: "review_card"; artifact: ReviewCard };

export async function syncArtifactComment(
	issueKey: string,
	entry: ArtifactEntry,
): Promise<void> {
	const ctx = await resolveConfigAndAuth();
	if (!ctx || !ctx.config.syncArtifacts) return;

	const { auth } = ctx;

	let adfBody: AdfDocument;
	switch (entry.type) {
		case "scope_card":
			adfBody = scopeCardToAdf(entry.artifact);
			break;
		case "research":
			adfBody = researchCardToAdf(entry.artifact);
			break;
		case "plan":
			adfBody = planToAdf(entry.artifact);
			break;
		case "review_card":
			adfBody = reviewCardToAdf(entry.artifact);
			break;
		default: {
			const _exhaustive: never = entry;
			throw new Error(
				`Unexpected artifact type: ${JSON.stringify(_exhaustive)}`,
			);
		}
	}

	const success = await addComment(auth, issueKey, adfBody);
	if (success) {
		log.jira.info(`Posted ${entry.type} comment on ${issueKey}`);
	} else {
		log.jira.warn(`Failed to post ${entry.type} comment on ${issueKey}`);
	}
}

/**
 * Sync pulse definitions as Sub-tasks under a workflow's Task.
 * Only creates Sub-tasks for pulses that don't already have a Jira issue ID.
 */
export async function syncPulses(
	plan: Plan,
	parentTaskKey: string,
): Promise<void> {
	const ctx = await resolveConfigAndAuth();
	if (!ctx || !ctx.config.syncWorkflows) return;

	const { config, auth } = ctx;

	const subtaskTypeId = await findIssueTypeId(
		auth,
		config.jiraProjectKey,
		"Sub-task",
	);
	if (!subtaskTypeId) {
		log.jira.warn("Sub-task issue type not found in Jira project");
		return;
	}

	const repos = getRepositories();
	const workflow = await repos.workflows.getById(plan.workflowId);
	if (!workflow) {
		log.jira.warn(`Workflow ${plan.workflowId} not found, skipping pulse sync`);
		return;
	}

	for (const pulse of plan.pulses) {
		try {
			// Check if pulse already has a Jira issue ID
			const existingPulse = await repos.pulses.getPulseByPlannedId(
				plan.workflowId,
				pulse.id,
			);

			if (existingPulse?.jiraIssueId) {
				log.jira.info(
					`Pulse "${pulse.title}" already synced as ${existingPulse.jiraIssueId}`,
				);
				continue;
			}

			// Create new Sub-task
			const issue = await createIssue(
				auth,
				config.jiraProjectKey,
				subtaskTypeId,
				pulse.title,
				pulse.description,
				parentTaskKey,
			);

			if (issue) {
				log.jira.info(
					`Created Sub-task ${issue.key} for pulse "${pulse.title}"`,
				);

				// Update pulse with Jira issue ID
				if (existingPulse) {
					await repos.pulses.updateJiraIssueId(existingPulse.id, issue.key);
				}

				// Assign sub-task to the authenticated user
				try {
					const accountId = await getCurrentUserAccountId(auth);
					if (accountId) {
						await updateIssue(auth, issue.key, { assignee: { accountId } });
					}
				} catch {
					log.jira.warn(`Could not assign Sub-task ${issue.key}`);
				}
			} else {
				log.jira.warn(`Failed to create Sub-task for pulse "${pulse.title}"`);
			}
		} catch (error) {
			log.jira.error(
				`Error creating Sub-task for pulse "${pulse.title}": ${error instanceof Error ? error.message : error}`,
			);
		}
	}
}

/**
 * Transition a pulse's Jira Sub-task to the appropriate status and, when
 * the pulse starts running, assign it to the authenticated user.
 */
export async function syncPulseStatus(
	pulseId: string,
	pulseStatus: "running" | "succeeded" | "failed" | "stopped",
): Promise<void> {
	const ctx = await resolveConfigAndAuth();
	if (!ctx || !ctx.config.syncWorkflows) return;

	const { config, auth } = ctx;

	const repos = getRepositories();
	const pulse = await repos.pulses.getPulse(pulseId);
	if (!pulse?.jiraIssueId) return;

	const issueKey = pulse.jiraIssueId;

	// Assign to current user when the pulse starts
	if (pulseStatus === "running") {
		try {
			const accountId = await getCurrentUserAccountId(auth);
			if (accountId) {
				await updateIssue(auth, issueKey, { assignee: { accountId } });
				log.jira.info(`Assigned Sub-task ${issueKey} to user ${accountId}`);
			}
		} catch (error) {
			log.jira.warn(
				`Failed to assign Sub-task ${issueKey}: ${error instanceof Error ? error.message : error}`,
			);
		}
	}

	// Transition status using the pulse status mapping
	const targetStatusId = config.pulseStatusMapping[pulseStatus];
	if (!targetStatusId) return;

	try {
		const success = await transitionIssue(auth, issueKey, targetStatusId);
		if (success) {
			log.jira.info(
				`Transitioned Sub-task ${issueKey} to status ${targetStatusId} (pulse ${pulseStatus})`,
			);
		} else {
			log.jira.warn(
				`Failed to transition Sub-task ${issueKey} to status ${targetStatusId}`,
			);
		}
	} catch (error) {
		log.jira.error(
			`Error transitioning Sub-task ${issueKey}: ${error instanceof Error ? error.message : error}`,
		);
	}
}

/**
 * Bulk sync an entire roadmap: milestones, initiatives, and dependencies.
 * Each entity is synced independently — partial failures don't block others.
 */
export async function syncRoadmap(
	milestones: Milestone[],
	initiatives: Initiative[],
	dependencies: Array<{
		sourceKey: string;
		targetKey: string;
	}>,
): Promise<void> {
	const ctx = await resolveConfigAndAuth();
	if (!ctx || !ctx.config.syncRoadmaps) return;

	// Sync milestones first (Epics)
	for (const milestone of milestones) {
		await syncMilestone(milestone);
	}

	// Reload milestones to get assigned Jira keys
	const milestoneKeyMap = new Map<string, string>();
	if (milestones.length > 0) {
		const projectRoot = getProjectRoot();
		const db = await getProjectDb(projectRoot);
		const milestoneRows = await db
			.selectFrom("milestones")
			.select(["id", "jira_epic_key"])
			.where(
				"id",
				"in",
				milestones.map((m) => m.id),
			)
			.execute();
		for (const r of milestoneRows) {
			if (r.jira_epic_key) {
				milestoneKeyMap.set(r.id, r.jira_epic_key);
			}
		}
	}

	// Sync initiatives (Stories under their milestone's Epic)
	for (const initiative of initiatives) {
		const parentEpicKey = milestoneKeyMap.get(initiative.milestoneId);
		await syncInitiative(initiative, parentEpicKey);
	}

	// Sync dependencies as issue links
	for (const dep of dependencies) {
		await syncDependency(dep.sourceKey, dep.targetKey);
	}
}
