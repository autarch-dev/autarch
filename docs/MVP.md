> NOTE: This document is from a previous iteration and _may_ be outdated.

# Autarch MVP (v0) — Local-First Workflow→Git OS

## 0) What this document is

This is the **build-facing MVP definition** for Autarch v0 (Local Mode). It is meant to be worked through to derive:

- a system architecture (components, boundaries, data model)
- an implementation plan (phases, acceptance criteria)
- a test strategy (unit/integration/e2e)
- validation signals (what "worked" means)

It intentionally prioritizes **product invariants + the core loop** over long-term roadmap.

---

## 1) MVP goal (one sentence)

Enable a solo developer to run **checkpointed agent pulses** on a **workflow branch in an isolated worktree**, then produce a **local Review Card** and perform a **pulse-preserving merge**—all from a **Stream-first UI**, with explicit approvals at trust boundaries.

---

## 2) Target user + target moment

- **Target user**: the "Architect-Builder" (one person who owns execution and merge decisions).
- **Target moment**: the user has an existing Git repo, wants to make a bounded change (feature/fix/refactor), and wants the system to:
  - keep work **legible** (why + what)
  - keep work **safe** (approvals, non-destructive rewind)
  - keep work **Git-native** (commits/branches as evidence)

---

## 3) The core loop to validate (the one thing)

**Hypothesis:** a developer will trust Autarch as the primary execution surface if it can repeatedly complete this loop end-to-end on a real repo.

### 3.1 The loop (happy path)

1. **Open repo / create project**
   - Select a base branch (default `main`).
2. **Create a Workflow channel**
   - Channel maps 1:1 to a workflow.
3. **Research → Plan (no Git side-effects)**
   - Gather repo context; produce a bounded plan.
4. **Enter Pulsing**
   - Create workflow branch.
   - Create isolated worktree for the workflow.
5. **Run a Pulse**
   - Execute a bounded unit of work.
   - Request approvals when needed at trust boundaries.
   - End the pulse only when a **checkpoint commit** exists.
6. **Request Review (explicit user action)**
   - Create a Review Card anchored in the Stream.
   - Primary diff range is:
     - **`[base branch OR last Review Card anchor] → [last pulse checkpoint commit]`**
7. **Merge (explicit user action)**
   - Perform a **pulse-preserving merge** into base branch.
   - Merge commit is Conventional Commits.
8. **Close channel**
   - Default-on **Knowledge Review** (skippable "Close without knowledge").
   - Promote 1–3 durable knowledge items (tags + provenance).

### 3.2 Core loop acceptance criteria

This loop is "validated" when:

- **Isolation**: pulses never require switching the user's active working directory; work happens in a worktree.
- **Durability**: every pulse ends in a checkpoint commit; crashes/stops preserve work as a recovery checkpoint.
- **Legibility**: Review Card is sufficient for a human to decide merge/no-merge without reconstructing context manually.
- **Trust gates**: approvals reliably gate `shell`, `network`, `git_dangerous`, and sensitive `share_to_model` scenarios.
- **Git-native**: merge preserves pulse commits (no squash), enabling later "reasoning blame" via history.

---

## 4) MVP scope (v0) — what ships

### 4.1 Project modes

- **Local Mode only**.
- Canonical Autarch state lives in a per-project DB under **`.autarch/`** (gitignored).
- No cloud sync, no multi-user channels.

### 4.2 Channel types

- **Workflow channels** (branch-backed): `Draft → Research → Plan → Pulsing → Review → (Merged | Abandoned) → Closed`.
- **Discussion channels**: read-only tool surface (no pulses, no Git side-effects) + Knowledge Review on close.

### 4.3 Wedge features (minimum viable set)

- **Stream-first UI**: channel timeline of messages + rich cards for Plan, Pulse, Review Card, Approvals, Knowledge Review.
- **Workflow↔Git**:
  - branch creation when entering Pulsing
  - pulse checkpoint commits
  - rewind via forked timeline (new branch from a prior commit)
  - pulse-preserving merge into base
- **Shadow workspace**:
  - workflow execution via `git worktree` under `.autarch/worktrees/<workflow-id>/...`
- **Review Cards**:
  - local review artifact + Markdown export (no re-import guarantee)
- **Approvals** (channel-scoped): one-shot + temporary allow-mode + per-channel overrides.
- **Minimal search**:
  - tags + SQLite FTS over finalized knowledge items
  - optional embeddings over finalized knowledge items only (thin slice)

---

## 5) Explicit non-goals (v0)

To keep v0 a wedge (not a platform), we explicitly do *not* ship:

- Remote host integrations (GitHub/GitLab APIs), built-in PRs, built-in push.
- Multi-repo workflows, stacked branches, workflow dependency DAG.
- Agent-driven merge conflict resolution.
- Full semantic search over raw threads/logs/code (v0 search is over finalized knowledge only).
- First-class history rewriting UX (`rebase`, `reset --hard`, etc.).
- "Always-on cloud sandbox" execution.
- Guaranteed re-importable exports.
- IDE bridge/extension (deferred to post-v0).
- Agent mentions (`@scoper`, `@builder`) — deferred to post-v0.
- Pluggable models - deferred to post v0.

---

## 6) Product invariants (must not break)

### 6.1 Source-of-truth rules

- **Code truth**: Git commits/branches are durable truth; pulse-end commits are canonical checkpoints.
- **Workflow truth**: workflow state machine + append-only event log live in the project DB.
- **Knowledge truth**: knowledge items are canonical in the DB; exports are derivative.

### 6.2 Pulse invariants

- A pulse **ends only** when a checkpoint commit exists.
- Pulse-end evidence includes:
  - checkpoint commit SHA
  - diff artifact ID
  - initiating message range (message IDs + revision IDs)
- Tests are required **only when explicitly requested** by the user or the plan for that pulse.

### 6.3 Safety / consent invariants

- No raw logs/env/secrets are sent to any model without explicit approval (content-based gating).
- Default excerpt for approvals is **last N lines**, expandable and editable.
- Approvals are channel-scoped.

---

## 7) Minimal conceptual data model (architecture input)

This is the smallest set of entities needed to support the wedge.

### 7.1 Core entities

- **Project**
  - repo path
  - base branch
  - mode = Local
  - per-project DB path (`.autarch/…`)
  - default approval policy
  - sensitive globs list
- **Channel**
  - id, type (Workflow | Discussion)
  - title
  - created_at, archived_at
  - membership (v0: implicit single user)
  - approval policy override (optional)
- **Workflow** (for Workflow channels)
  - state (Draft/Research/Plan/Pulsing/Review/Merged/Abandoned/Closed)
  - base branch
  - workflow branch name
  - worktree path
  - current timeline branch ref (for rewind forks)
  - last review anchor (commit SHA)
- **Message**
  - immutable id
  - revisions (append-only)
  - tombstone/redaction flag
- **Pulse**
  - id
  - workflow id
  - initiating message range (message id + revision id)
  - status (proposed/running/succeeded/failed/stopped)
  - checkpoint commit SHA
  - diff artifact id
  - test evidence artifact id(s) (optional)
- **Artifact**
  - id
  - kind (diff, command_output_excerpt, test_output, review_markdown_export, …)
  - storage (in DB)
  - redaction metadata
- **Approval**
  - id
  - category (`repo_read`, `repo_write`, `shell`, `network`, `share_to_model`, `git_safe`, `git_dangerous`)
  - scope (one-shot / allow-mode / channel override)
  - payload (e.g., command, domains, excerpt)
- **KnowledgeItem**
  - id
  - text
  - tags (namespaced)
  - provenance (channel + message ranges + commit SHA(s))
  - status (draft | finalized)

### 7.2 Append-only event log

All meaningful state transitions are recorded as immutable events referencing IDs above (with large payloads stored as artifacts).

---

## 8) Implementation phases (v0)

The phases below are ordered to validate the core loop early and reduce architectural thrash. Approvals are implemented before real agent execution to ensure trust boundaries are enforceable from the start.

### Phase 0 — Repo + DB foundation (project open)

**Goal:** Open an existing Git repo and initialize a per-project DB under `.autarch/`.

- **Deliverables**
  - project creation/open flow
  - base branch selection (default `main`)
  - `.autarch/` creation + gitignore entry
  - SQLite schema migrations + versioning
  - `.autarchignore` support (additive to `.gitignore`)
  - built-in exclusion rules (`node_modules/`, `dist/`, binaries, `.autarch/`)
  - sensitive globs configuration (`.env*`, keys/certs patterns)
  - per-project defaults store (model config, approval policy defaults)
- **Acceptance tests**
  - open repo with `main` / `master` / custom base branch
  - `.autarch/` is always excluded from indexing/exports
  - `.autarchignore` rules respected during indexing
  - sensitive globs never auto-included in model context

### Phase 1 — Stream + messaging primitives

**Goal:** A usable Stream UI backed by durable messages (ids, revisions, tombstones), with both channel types.

- **Deliverables**
  - channel list + channel view
  - channel type selection (Workflow | Discussion) on creation
  - message append
  - message edit → creates revision
  - delete → tombstone
  - Discussion channels: read-only contract enforcement (no pulses, no Git ops)
- **Acceptance tests**
  - provenance references remain stable when messages are edited
  - tombstoned messages are excluded from retrieval/context
  - Discussion channels reject pulse/Git operations at the API level

### Phase 2 — Workflow state machine + event log

**Goal:** Workflow channels have a real lifecycle stored in DB + validated against invariants.

- **Deliverables**
  - workflow channel type with lifecycle: `Draft → Research → Plan → Pulsing → Review → (Merged | Abandoned) → Closed`
  - lifecycle transitions with validation
  - append-only event log API
  - artifact storage (blobs in DB, referenced by ID)
- **Acceptance tests**
  - invalid transitions rejected
  - event log is append-only; corrections are new events
  - artifacts retrievable by ID

### Phase 3 — Git integration: branch + worktree + checkpointing

**Goal:** Create workflow branch on entering Pulsing; run in worktree; produce checkpoint commits.

- **Deliverables**
  - `enter_pulsing()` creates branch + worktree under `.autarch/worktrees/<workflow-id>/`
  - worktree registry in DB (for cleanup/recovery)
  - "checkpoint commit" utility with pulse-style format + Autarch trailers (`Autarch-Workflow`, `Autarch-Pulse`)
  - "recovery checkpoint" commit format (for crash/stop scenarios)
  - crash/stop recovery checkpoint commit if dirty
  - rewind via forked timelines (create new branch ref from prior commit)
- **Acceptance tests (integration)**
  - worktree exists and is isolated from user working directory
  - checkpoint commit exists after each pulse end
  - checkpoint commits include `Autarch-Workflow` and `Autarch-Pulse` trailers
  - crash recovery commit created on simulated failure
  - rewind forks a new branch without rewriting history

### Phase 4 — Approvals + consent gates (trust boundary)

**Goal:** Implement enforceable approval categories and UX before agent execution.

- **Deliverables**
  - category model (`repo_read`, `repo_write`, `shell`, `network`, `share_to_model`, `git_safe`, `git_dangerous`)
  - one-shot approvals
  - temporary allow-mode (timeboxed or next-N-pulses)
  - per-channel overrides (inherit from per-project defaults)
  - consent excerpt UX (last N lines, expandable/editable)
  - sensitive globs gating for `share_to_model` (even if not ignored)
- **Acceptance tests**
  - `shell` cannot run without approval by default
  - `network` cannot be used without approval by default
  - `share_to_model` prompts for logs/ignored paths/sensitive globs
  - allow-mode expires correctly
  - per-channel overrides do not leak to other channels

### Phase 5 — Pulse runner (thin slice)

**Goal:** A pulse can execute bounded work and end in a checkpoint commit + diff artifact, using deterministic operations.

- **Approach**
  - Start with a minimal "mock runner" that applies scripted/deterministic edits to validate end-to-end plumbing.
  - This validates the pulse contract (events, checkpointing, artifacts, message queueing) without agent complexity.

- **Deliverables**
  - pulse proposal card in Stream
  - pulse execution events (start/progress/end)
  - pulse-end evidence: commit SHA + diff artifact + initiating message range (with revision IDs)
  - queued messages during pulse (append on pulse end with "queued during pulse" annotation)
  - stop action creates recovery checkpoint if dirty
- **Acceptance tests**
  - queued messages never affect the in-flight pulse inputs
  - pulse end fails if checkpoint commit cannot be created
  - stop mid-pulse preserves work via recovery checkpoint

### Phase 6 — Native C# Agent integration

**Goal:** Connect a real agent loop to Autarch's pulse/approval semantics while keeping **Core** as the enforcement point for approvals + **Guarantee A**.

- **Deliverables**
  - `Autarch.Agent` namespace — native C# agent implementation
  - Agent loop integration with approval gates (pause for consent before tool execution)
  - Context-aware tool implementations (mediated by Core services):
    - `read_file` — respects ignore rules, can inject L3 context pins
    - `search` — uses indexed graph/FTS, not raw grep
    - `ls` — respects ignore rules
    - `write_file` — gated by `repo_write` approval on sensitive globs
    - `shell` — gated by `shell` approval
  - `share_to_model` enforcement at the agent loop level (Guarantee A)
  - Pulse-end checkpoint triggered by agent via service call
  - LLM provider abstraction (OpenAI, Anthropic, Ollama) with async streaming support

- **Acceptance tests**
  - agent cannot bypass approval gates (no side-effects without Core-mediated approvals)
  - `share_to_model` content-based gating works for logs/ignored/sensitive
  - agent tools use Autarch's indexed data (not raw filesystem grep)
  - pulse-end checkpoint commit created via agent signal

### Phase 7 — Model configuration (pluggable models)

**Goal:** Users can configure model selection per-channel and per-stage.

- **Deliverables**
  - model provider configuration (OpenAI, Anthropic, Ollama) with API key management
  - per-project default model config
  - per-channel model override
  - stage-based model selection (Research/Plan/Pulsing/Review can use different models)
  - model selection UI in channel settings
- **Acceptance tests**
  - channel inherits project defaults unless overridden
  - stage-based selection routes to correct model
  - Ollama (local) works without API key

### Phase 8 — Review Card (local PR semantics)

**Goal:** Convert pulse evidence into a reviewable artifact anchored in the Stream.

- **Deliverables**
  - Request Review action (explicit user action; agent can propose)
  - Review Card generation with plan/pulses/test evidence
  - diff range logic: `[base branch OR last Review Card anchor] → [last pulse checkpoint commit]`
  - Markdown export (non re-importable)
  - Review Card anchored in Stream as rich message card
- **Acceptance tests**
  - Review Card diff is stable and matches Git
  - repeated reviews are incremental via last-review anchor
  - Markdown export is human-readable and includes provenance references

### Phase 9 — Merge (pulse-preserving) + Close

**Goal:** Merge preserves pulse commits and produces a clean macro history; closing triggers Knowledge Review.

- **Deliverables**
  - explicit merge proposal + user confirm (agent can propose; user triggers)
  - pulse-preserving merge into base branch (no squash)
  - merge commit message format (Conventional Commits + Autarch trailers including `Autarch-Stream-ID`)
  - close flow: Knowledge Review default-on, skippable ("Close without knowledge")
  - channel becomes read-only after close
- **Acceptance tests**
  - base branch includes pulse commits after merge
  - merge commit includes `Autarch-Stream-ID` trailer
  - rollback story: revert merge commit is possible and documented
  - closing makes channel read-only

### Phase 10 — Knowledge + semantic search

**Goal:** Durable L3 knowledge items with provenance + tags; searchable via FTS; Discussion channels as first-class knowledge surface; optional semantic search over code and knowledge.

- **Deliverables**
  - pins (explicit user action during workflow/discussion)
  - close-time extraction draft generation (LLM-driven; initially can be stub/template)
  - Knowledge Review UI (approve/edit/tag proposed items)
  - finalized knowledge stored with provenance (channel + message ranges + commit SHAs)
  - namespaced tags (e.g., `feature:*`, `pattern:*`, `stack:*`)
  - SQLite FTS over finalized knowledge items
  - optional: embedding index over knowledge AND code (shared infrastructure for "vibes" queries)
    - embedding model: `nomic-embed-text-v1.5` via ONNX Runtime (int8, ~140MB)
    - content-addressed storage: embeddings keyed by content hash (deduped across worktrees)
    - scoped file indexes: each worktree maintains path→hash mappings for search filtering
    - vector storage: sqlite-vec or HNSW.Net
    - incremental indexing: on project open (main), on pulse start (worktree), debounced file changes
    - unified search interface (FTS + semantic ranking)
  - Discussion channels: knowledge retrieval tools (search/get knowledge items + provenance)
  - "Dig deeper" via provenance links (link to source thread/commits)
- **Acceptance tests**
  - provenance links resolve to messages + commits
  - search returns correct items by tag and keyword
  - Discussion channel can retrieve and cite knowledge items
  - Knowledge Review produces at least one item with valid provenance
  - (if embeddings enabled) semantic query "function that validates emails" finds relevant code

---

## 9) Testing strategy

### 9.1 Unit tests (fast)

- **Workflow state machine**: transition rules, invalid transitions.
- **Approval policy**: category checks, scope rules (one-shot vs allow-mode).
- **Message revisions/tombstones**: stable IDs and revision selection.
- **Diff range logic**: base/last-review anchor computations.

### 9.2 Integration tests (real Git)

Run against ephemeral repos created during tests:

- create repo with commits; open as project
- enter Pulsing creates branch + worktree
- pulse-end checkpoint commit created
- diff artifact matches `git diff` expectations
- rewind forks timeline from checkpoint
- merge preserves pulse commits and creates merge commit

### 9.3 End-to-end tests (app-level)

- create workflow channel → plan card → start pulse → approvals → checkpoint → request review → merge → close
- ensure Stream cards update deterministically from events

### 9.4 "Golden scenario" dogfood script

A single scenario run repeatedly on Autarch's own repo:

- "Add a small UI element + wire it to a ViewModel"
- at least 2 pulses
- at least 1 approval-required shell action
- request review
- merge
- close with 1–3 knowledge items

---

## 10) Validation signals (what we track)

### 10.1 Core loop success metrics

- **Time-to-first-merged-workflow** on an existing repo.
- **Workflow completion rate** (created → merged → closed).
- **Pulse success rate** (started → checkpointed) and failure reasons.

### 10.2 Trust/UX friction metrics

- approvals per pulse (especially `shell`/`network`)
- how often users enable allow-mode and for how long
- stop/cancel frequency
- crash recovery frequency
- rewind usage (did checkpoints save time?)

### 10.3 Legibility metrics

- review decision time (request review → merge/abandon)
- number of "where did this come from?" moments measured via:
  - clicks from diff → provenance → message
  - edits to Review Card summary (proxy for initial clarity)

### 10.4 Knowledge metrics

- close-with-knowledge vs close-without-knowledge rate
- number of finalized knowledge items per workflow
- future retrieval usefulness (manual rating during dogfood)

---

## 11) Key risks + mitigations

- **Risk: approvals overwhelm the flow**
  - Mitigation: channel-scoped allow-mode + narrow default gating scope (logs/ignored/sensitive for `share_to_model`).

- **Risk: worktree lifecycle complexity (orphaned worktrees, cleanup)**
  - Mitigation: explicit worktree registry in DB + repair tool + conservative cleanup.

- **Risk: Review Card isn't sufficient for confidence**
  - Mitigation: enforce pulse evidence, show incremental diffs, link provenance, include test evidence when requested.

- **Risk: "Local-only" limits collaboration perception**
  - Mitigation: strong Markdown export story + clean Git history + commit trailers groundwork.

- **Risk: Agent integration complexity (native C# agent development)**
  - Mitigation: start with minimal tool surface; leverage existing .NET LLM libraries (e.g., Semantic Kernel, LLamaSharp) where appropriate; keep agent loop simple and auditable.

---

## 12) Definition of Done (v0)

Autarch v0 is "done" when a developer can, on an existing repo, complete the core loop **three times in a row** with:

- zero manual branch switching in their primary workspace
- at least one `shell` approval per workflow
- stable checkpoint commits per pulse
- a Review Card that matches Git and supports the merge decision
- a pulse-preserving merge
- a close-time Knowledge Review producing at least one useful knowledge item
