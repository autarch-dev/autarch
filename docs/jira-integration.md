# Jira Integration — Roadmaps & Workflows

One-way sync from Autarch → Jira. Autarch is the source of truth; Jira is a projection for team visibility.

---

## Conceptual Mapping

### Roadmap Entities

| Autarch | Jira | Notes |
|---------|------|-------|
| **Roadmap** | **Project** or **Advanced Roadmap plan** | Container-level mapping |
| **Milestone** | **Epic** or **Fix Version** | Groups of initiatives |
| **Initiative** | **Story** (if milestones → Epics) or **Epic** (if milestones → Fix Versions) | Depends on chosen hierarchy |
| **Vision Document** | **Project description / Confluence link** | No direct Jira analog |
| **Roadmap Dependency** | **Issue Link (`blocks` / `is blocked by`)** | Standard Jira link type |

### Workflow Entities

| Autarch | Jira | Notes |
|---------|------|-------|
| **Workflow** | **Issue (Story/Task)** | Unit of work |
| **Workflow Status** | **Issue Status** | Custom status mapping required (Autarch has 7 stages, Jira workflows vary per project) |
| **Workflow Priority** | **Issue Priority** | Direct: `low` / `medium` / `high` / `urgent` |
| **Scope Card** | **Comment (ADF-formatted)** | Pushed as a structured comment on the Jira issue |
| **Research Card** | **Comment (ADF-formatted)** | Same |
| **Plan (Pulses)** | **Sub-tasks** | Each `PulseDefinition` → one Jira sub-task |
| **Review Card** | **Comment (ADF-formatted)** | Review summary + recommendation pushed as a comment |

---

## Data Model Additions

### New fields on existing schemas

```typescript
// Initiative (roadmap.ts)
jiraIssueKey?: string;    // e.g., "PROJ-123"
jiraIssueId?: string;     // Jira's internal ID
jiraSyncedAt?: number;    // last push timestamp

// Milestone (roadmap.ts)
jiraEpicKey?: string;
jiraEpicId?: string;

// Workflow (workflow.ts)
jiraIssueKey?: string;
jiraIssueId?: string;
jiraSyncedAt?: number;
```

### Per-project integration config table

Each Autarch project can have its own Jira configuration. All mapping is project-scoped — different repos can push to different Jira projects with different mappings.

```typescript
// jira_config (one row per Autarch project)
{
  id: string;
  enabled: boolean;

  // Connection
  jiraBaseUrl: string;            // e.g., "https://myteam.atlassian.net"
  jiraProjectKey: string;         // e.g., "PROJ"
  authMethod: "oauth2" | "api_token";
  // credentials stored securely outside this table

  // Sync toggles
  syncRoadmaps: boolean;          // push roadmap milestones/initiatives
  syncWorkflows: boolean;         // push workflow status transitions
  syncArtifacts: boolean;         // push scope/research/plan/review as comments

  // Entity mapping (how Autarch hierarchy maps to Jira hierarchy)
  milestoneMapping: "epic" | "fix_version";  // Milestone → Epic or Fix Version
  initiativeMapping: "story" | "task";       // Initiative → Story or Task
  workflowIssueType: "story" | "task";       // Workflow → Story or Task

  // Status mapping (Autarch workflow status → Jira status ID)
  // Jira status IDs are fetched from the Jira project's workflow scheme
  statusMapping: {
    backlog: string | null;       // null = don't transition
    scoping: string | null;
    researching: string | null;
    planning: string | null;
    in_progress: string | null;
    review: string | null;
    done: string | null;
  };

  // Priority mapping (Autarch priority → Jira priority ID)
  priorityMapping: {
    low: string;
    medium: string;
    high: string;
    urgent: string;
  };

  createdAt: number;
  updatedAt: number;
}

---

## Configuration UI

A dedicated **Settings → Jira** page, scoped to the current project. The UI has three sections:

### Connection

- **Base URL** — text input, e.g., `https://myteam.atlassian.net`
- **Project key** — text input, e.g., `PROJ`. Once entered, the service fetches available issue types, statuses, and priorities from the Jira project to populate the mapping dropdowns.
- **Auth method** — toggle between OAuth 2.0 and API token. API token shows email + token fields. OAuth shows a "Connect to Jira" button that initiates the 3LO flow.
- **Test connection** button — verifies credentials and project access.

### Entity Mapping

- **Milestone → ?** — dropdown: `Epic` or `Fix Version`
- **Initiative → ?** — dropdown: `Story` or `Task` (populated from Jira project's issue types)
- **Workflow → ?** — dropdown: `Story` or `Task`

A preview block shows the resulting hierarchy, e.g.:

```
Jira Project (PROJ)
└── Epic (Milestone: "MVP Launch")
    ├── Story (Initiative: "Auth system")
    └── Story (Initiative: "Dashboard")
```

### Status & Priority Mapping

- **Status mapping** — a two-column table. Left column: Autarch's 7 workflow statuses (fixed). Right column: dropdown of Jira statuses fetched from the project's workflow scheme. Each row can be set to a Jira status or left as "Don't sync" (null).
- **Priority mapping** — same pattern. Left: Autarch's 4 priorities. Right: dropdown of Jira priorities.

### Sync Toggles

Three checkboxes at the top of the page:

- **Sync roadmaps** — push milestones and initiatives on roadmap finalization
- **Sync workflows** — push status transitions on stage changes
- **Sync artifacts** — push Scope Card / Research / Plan / Review as comments

All toggles are independent. A user might want roadmap export without workflow status push, or vice versa.

---

## Service Layer

A `src/backend/services/jira.ts` service handles all outbound communication:

- **Authentication** — OAuth 2.0 (3LO) for Jira Cloud, or API token for simpler setups.
- **Issue CRUD** — Create/update Jira issues when roadmap items or workflows change.
- **Status push** — Map Autarch's 7-stage workflow status to Jira statuses using the per-project `statusMapping` config. Statuses mapped to `null` are skipped.
- **Artifact rendering** — Convert Scope Cards, Research Cards, Plans, and Review Cards into ADF (Atlassian Document Format) for Jira comments.

---

## Integration Points in Existing Code

### Roadmap push

- **`roadmapRoutes.ts`** — After synthesis completes and the roadmap is finalized, trigger a Jira push of Milestones as Epics and Initiatives as Stories. The existing `broadcast(createRoadmapUpdatedEvent(...))` pattern is a natural hook — add a Jira sync call alongside the WebSocket broadcast.
- **`RoadmapRepository.ts`** — `createInitiative` and `updateInitiative` are natural places to trigger Jira sync for individual items.

### Workflow status push

- On every stage transition (the `APPROVAL_REQUIRED_TOOLS` and `AUTO_TRANSITION_TOOLS` maps in `workflow.ts`), push a status update to the linked Jira issue.
- The `Initiative.workflowId` foreign key is already the bridge between roadmaps and workflows — when a workflow progresses, the linked initiative's Jira issue gets a status update too.
- Push artifact summaries (Scope Card, Plan, Review Card) as Jira comments at each approval gate.

---

## Release Scope

Everything ships together:

- Settings → Jira page with connection, entity mapping, status/priority mapping, and sync toggles.
- Jira metadata fetch (issue types, statuses, priorities) to populate mapping dropdowns.
- "Export to Jira" button on a finalized roadmap — pushes Milestones and Initiatives using the configured entity mapping, Dependencies as issue links.
- Stores `jiraIssueKey` / `jiraEpicKey` back on the Autarch entities for future re-sync.
- Workflow status push — when a Workflow progresses through stages, push status updates using the per-project `statusMapping`.
- Artifact comments — push Scope Card / Plan / Review Card summaries as ADF-formatted Jira comments at each gate (controlled by the `syncArtifacts` toggle).

---

## Design Constraints

- **No bidirectional sync.** Autarch is authoritative for all state. Jira is a read-only projection. Changes in Jira are not pulled back.
- **Don't model Autarch artifacts as Jira custom fields.** Scope Cards, Research Cards, etc. are too structured. Push them as well-formatted comments.
- **Don't sync sub-pulse granularity.** Jira sub-tasks per Pulse make sense; syncing individual checkpoint commits would be noise.
- **Autarch's state machine is richer than Jira's.** The 7-stage pipeline with approval gates doesn't map 1:1 to most Jira workflows, so the status mapping must be user-configurable.
