# Jira Integration — Roadmaps & Workflows

One-way sync from Autarch → Jira. Autarch is the source of truth; Jira is a projection for team visibility.

---

## Conceptual Mapping

| Autarch | Jira | Notes |
|---------|------|-------|
| **Roadmap** | *(no direct mapping)* | Autarch-only container; not represented in Jira |
| **Milestone** | **Epic** | Groups of initiatives |
| **Initiative** | **Story** | Child issue under the milestone's Epic |
| **Workflow** | **Task** | Child issue under the initiative's Story |
| **Pulse** | **Sub-task** | Child of the workflow's Task; each `PulseDefinition` → one Jira sub-task |
| **Vision Document** | *(no direct mapping)* | No Jira analog |
| **Roadmap Dependency** | **Issue Link (`blocks` / `is blocked by`)** | Standard Jira link type |
| **Workflow Status** | **Issue Status** | Custom status mapping required (Autarch has 7 stages, Jira workflows vary per project) |
| **Scope Card** | **Comment (ADF-formatted)** | Pushed as a structured comment on the workflow's Task |
| **Research Card** | **Comment (ADF-formatted)** | Same |
| **Review Card** | **Comment (ADF-formatted)** | Review summary + recommendation pushed as a comment |

---

## Data Model Additions

### New fields on existing schemas

```typescript
// Milestone (roadmap.ts)
jiraEpicKey?: string;     // e.g., "PROJ-10"
jiraEpicId?: string;      // Jira's internal ID
jiraSyncStatus?: "pending" | "synced" | "error";
jiraSyncedAt?: number;
jiraSyncError?: string;   // last error message (cleared on success)

// Initiative (roadmap.ts)
jiraIssueKey?: string;    // e.g., "PROJ-123" (Story)
jiraIssueId?: string;     // Jira's internal ID
jiraSyncStatus?: "pending" | "synced" | "error";
jiraSyncedAt?: number;
jiraSyncError?: string;   // last error message (cleared on success)

// Workflow (workflow.ts)
jiraIssueKey?: string;    // e.g., "PROJ-124" (Task)
jiraIssueId?: string;     // Jira's internal ID
jiraSyncStatus?: "pending" | "synced" | "error";
jiraSyncedAt?: number;
jiraSyncError?: string;   // last error message (cleared on success)
```

### Per-project integration config (stored in `project_meta`)

Each Autarch project can have its own Jira configuration. The config is stored as a JSON blob in the `project_meta` key-value table (key: `jira_config`), following the same pattern as merge strategy, post-write hooks, and other project-scoped settings. Since each project has its own SQLite database, the config is inherently project-scoped.

Credentials (API token + email) are stored in the **global settings database**, keyed per project path — following the same pattern as LLM provider API keys.

```typescript
// project_meta key: "jira_config"
{
  enabled: boolean;

  // Connection
  jiraBaseUrl: string;            // e.g., "https://myteam.atlassian.net"
  jiraProjectKey: string;         // e.g., "PROJ"

  // Sync toggles
  syncRoadmaps: boolean;          // push roadmap milestones/initiatives
  syncWorkflows: boolean;         // push workflow status transitions
  syncArtifacts: boolean;         // push scope/research/plan/review as comments

  // Entity mapping — fixed hierarchy, no user configuration needed:
  // Milestone → Epic, Initiative → Story, Workflow → Task, Pulse → Sub-task

  // Status mapping — keyed by Jira issue type, since different issue types
  // can have different workflow schemes in the same Jira project.
  // Each maps Autarch workflow status → Jira status ID (null = don't transition).
  statusMapping: {
    [jiraIssueTypeId: string]: {
      backlog: string | null;
      scoping: string | null;
      researching: string | null;
      planning: string | null;
      in_progress: string | null;
      review: string | null;
      done: string | null;
    };
  };

  // Priority mapping
  initiativePriorityMapping: {
    low: string;      // Jira priority ID
    medium: string;
    high: string;
    critical: string;
  };
  workflowPriorityMapping: {
    low: string;      // Jira priority ID
    medium: string;
    high: string;
    urgent: string;
  };
}
```

---

## Configuration UI

A dedicated **Settings → Jira** page, scoped to the current project. The UI has three sections:

### Connection

- **Base URL** — text input, e.g., `https://myteam.atlassian.net`
- **Project key** — text input, e.g., `PROJ`. Once entered, the service fetches available issue types, statuses, and priorities from the Jira project to populate the mapping dropdowns.
- **API token** — email + token fields. Stored in the global settings database.
- **Test connection** button — verifies credentials and project access.

### Entity Mapping

The hierarchy is fixed — no user configuration needed:

```
Jira Project (PROJ)
└── Epic (Milestone: "MVP Launch")
    ├── Story (Initiative: "Auth system")
    │   └── Task (Workflow: "Implement OAuth")
    │       ├── Sub-task (Pulse 1: "Add provider")
    │       └── Sub-task (Pulse 2: "Add tests")
    └── Story (Initiative: "Dashboard")
```

### Status & Priority Mapping

- **Status mapping** — for the Task issue type (workflows). A two-column table: left column shows Autarch's 7 workflow statuses (fixed), right column is a dropdown of Jira statuses fetched from the Task issue type's workflow scheme. Each row can be set to a Jira status or left as "Don't sync" (null).
- **Initiative priority mapping** — left: Autarch's 4 initiative priorities (`low` / `medium` / `high` / `critical`). Right: dropdown of Jira priorities.
- **Workflow priority mapping** — left: Autarch's 4 workflow priorities (`low` / `medium` / `high` / `urgent`). Right: dropdown of Jira priorities.

### Sync Toggles

Three checkboxes at the top of the page:

- **Sync roadmaps** — automatically push milestones and initiatives when roadmaps are finalized or modified
- **Sync workflows** — automatically push status transitions on stage changes
- **Sync artifacts** — push Scope Card / Research / Plan / Review as comments

All toggles are independent. A user might want roadmap sync without workflow status push, or vice versa. When Jira is configured and a toggle is enabled, syncing happens automatically — there is no manual export step.

---

## Service Layer

A `src/backend/services/jira.ts` service handles all outbound communication:

- **Authentication** — API token (email + token pair) for Jira Cloud. Credentials are read from the global settings database.
- **Issue CRUD** — Create/update Jira issues when roadmap items or workflows change. All operations are idempotent: if an entity already has a `jiraIssueKey`, the service updates the existing issue rather than creating a duplicate. The `jiraSyncStatus` field tracks the state of each entity's sync.
- **Status push** — Map Autarch's 7-stage workflow status to Jira statuses using the per-issue-type `statusMapping` config. Statuses mapped to `null` are skipped.
- **Artifact rendering** — Convert Scope Cards, Research Cards, Plans, and Review Cards into ADF (Atlassian Document Format) for Jira comments.

### Idempotency

Sync is idempotent at the individual issue level:

1. **Create-or-update** — If `jiraIssueKey` is set on an Autarch entity, the service issues a PUT (update). If not, it issues a POST (create) and stores the returned key/ID back on the entity.
2. **Sync status tracking** — Each entity has a `jiraSyncStatus` field (`pending` | `synced` | `error`). On successful push, status is set to `synced` and `jiraSyncedAt` is updated. On failure, status is set to `error` and `jiraSyncError` captures the message.
3. **Partial failure resilience** — A bulk roadmap sync pushes each milestone and initiative independently. If one fails, the others still succeed. Failed entities are marked `error` and can be retried on the next sync trigger.
4. **Dirty checking** — An entity is re-synced only if its `updatedAt` is newer than its `jiraSyncedAt`, avoiding unnecessary API calls.

### Error Handling & Retry

All Jira API calls are **non-blocking** — failures never block workflow progression or roadmap operations.

- **Retry with backoff** — Transient errors (HTTP 429, 5xx) are retried up to 3 times with exponential backoff (1s, 2s, 4s).
- **Non-retryable errors** — Client errors (4xx except 429) are not retried. The error is logged and stored in `jiraSyncError` on the entity.
- **User visibility** — Sync failures are surfaced in the Settings → Jira UI as a list of entities with `error` status, along with the error message. A "Retry failed" button re-triggers sync for all errored entities.
- **Logging** — All Jira API interactions are logged via a dedicated `jira` namespace added to the existing `log` infrastructure (`log.jira.info`, `log.jira.error`). Requires adding `jira: createLogger("jira")` to `src/backend/logger.ts`.

---

## Integration Points in Existing Code

### Roadmap sync (automatic)

- **`roadmapRoutes.ts`** — After synthesis completes and the roadmap is finalized, trigger a Jira sync of Milestones and Initiatives. The existing `broadcast(createRoadmapUpdatedEvent(...))` pattern is a natural hook — add a fire-and-forget Jira sync call alongside the WebSocket broadcast.
- **`RoadmapRepository.ts`** — `createInitiative`, `updateInitiative`, `createMilestone`, `updateMilestone`, `createDependency`, and `deleteDependency` trigger Jira sync for the affected items. Sync is idempotent: dirty-checked via `updatedAt` vs `jiraSyncedAt`.
- **Delete handling** — `deleteInitiative` transitions the linked Jira issue to a closed/done status (using the `done` entry from `statusMapping`). `deleteMilestone` does the same for the linked Epic. Autarch never deletes Jira issues — it only transitions them.
- All sync calls are gated on `jiraConfig.enabled && jiraConfig.syncRoadmaps`.

### Workflow status sync (automatic)

- **`WorkflowOrchestrator.transitionStage()`** — On every stage transition, fire-and-forget a Jira status update to the linked issue. This is the single code path through which all stage changes flow.
- **Workflow → Task** — Each workflow gets its own Jira Task, created as a child of the linked Initiative's Story (via `Initiative.workflowId` FK). When `transitionStage()` fires, it reads the workflow's `jiraIssueKey` and pushes the status transition to that Task.
- If a workflow has no linked initiative (standalone workflow without a roadmap), it still gets a Jira Task but without a parent Story.
- All sync calls are gated on `jiraConfig.enabled && jiraConfig.syncWorkflows`.

### Artifact comment sync (automatic)

- **`WorkflowOrchestrator.approveArtifact()`** — On each approval gate, push the approved artifact (Scope Card, Research Card, Plan, Review Card) as an ADF-formatted Jira comment on the linked issue.
- All sync calls are gated on `jiraConfig.enabled && jiraConfig.syncArtifacts`.

---

## Release Scope

Everything ships together:

- Settings → Jira page with connection (API token), status mapping, priority mapping (initiative + workflow), and sync toggles.
- Jira metadata fetch (issue types, statuses per issue type, priorities) to populate mapping dropdowns.
- Automatic roadmap sync — when a roadmap is finalized or modified, milestones, initiatives, and dependencies are pushed to Jira. Milestone/initiative deletes transition the linked Jira issue to done (never delete). Gated on `syncRoadmaps` toggle.
- Stores `jiraIssueKey` / `jiraEpicKey` back on Autarch entities. Tracks per-entity `jiraSyncStatus` for idempotent re-sync.
- Automatic workflow sync — workflows are pushed as Jira Tasks (children of the initiative's Story). Stage transitions push status updates to the workflow's Task. Pulses are pushed as Sub-tasks under the Task. Gated on `syncWorkflows` toggle.
- Automatic artifact comment sync — Scope Card / Plan / Review Card summaries pushed as ADF-formatted Jira comments at each approval gate. Gated on `syncArtifacts` toggle.
- Error handling — retries with exponential backoff for transient failures, per-entity error tracking, non-blocking sync that never stalls workflows.

---

## Design Constraints

- **No bidirectional sync.** Autarch is authoritative for all state. Jira is a read-only projection. Changes in Jira are not pulled back.
- **Don't model Autarch artifacts as Jira custom fields.** Scope Cards, Research Cards, etc. are too structured. Push them as well-formatted comments.
- **Don't sync sub-pulse granularity.** Jira sub-tasks per Pulse make sense; syncing individual checkpoint commits would be noise.
- **Autarch's state machine is richer than Jira's.** The 7-stage pipeline with approval gates doesn't map 1:1 to most Jira workflows, so the status mapping must be user-configurable and keyed per Jira issue type.
- **Jira Cloud only.** Jira Server and Jira Data Center are explicitly out of scope. They use different auth mechanisms (PAT / basic auth with different headers) and different REST API base paths (`/rest/api/2` vs `/rest/api/3`).
- **API token auth only (v1).** OAuth 2.0 (3LO) is deferred — redirect URI handling for a local desktop app adds significant complexity. API token auth covers the common Jira Cloud use case.
- **Credentials in global settings DB.** Jira API token and email are stored in the global settings database, keyed per project path, following the same pattern as LLM provider API keys.
- **Non-blocking sync.** All Jira API calls are fire-and-forget with retry. Failures are tracked per-entity and never block workflow progression or roadmap operations.
- **Idempotent per-entity sync.** Each Autarch entity tracks its own `jiraSyncStatus`, `jiraSyncedAt`, and `jiraSyncError`. Dirty checking (`updatedAt` > `jiraSyncedAt`) prevents redundant pushes. Partial failures don't prevent other entities from syncing.
