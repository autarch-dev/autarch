> NOTE: This document is from a previous iteration and _may_ be outdated.

# Autarch Roadmap

This roadmap is ordered to validate the **core loop wedge** early:

> workflow channel ↔ workflow branch/worktree ↔ checkpointed pulses ↔ Review Card ↔ pulse-preserving merge ↔ close-time Knowledge Review

It is written as a **sequenced set of milestones** with exit criteria, not as calendar promises.

---

## Guiding principles (roadmap rules)

- **Validate the wedge before expanding surfaces**: do not build “nice-to-have UI” ahead of end-to-end core loop capability.
- **Keep v0 local-only**: no Git host APIs, no push, no cloud. Collaboration in v0 is via **Git history** + **Review Card Markdown export**.
- **Trust boundaries first-class**: approvals/consent are part of the product, not a later hardening step.
- **Git-native time travel**: rewind uses forked timelines (new branch from checkpoint), not filesystem snapshots.

---

## Now: v0 (Local Mode) — ship the wedge

### Milestone 0 — Project foundation

**Goal**: open existing repos and persist project state locally.

- **Scope**
  - Open existing repo; select base branch (default `main`).
  - Create `.autarch/` (gitignored) and per-project SQLite DB.
  - Minimal schema migrations/versioning.
- **Exit criteria**
  - Can open 3 different repos (small JS, Rust, mixed monorepo) and persist/reopen project state without corruption.

### Milestone 1 — Stream + channel primitives

**Goal**: a usable Stream surface that can host structured cards later.

- **Scope**
  - Channel list + channel view.
  - Message IDs; edits create revisions; deletes are tombstones.
  - Discussion vs Workflow channel types (enforced).
- **Exit criteria**
  - Messages are durable, linkable, and revision-safe for provenance.

### Milestone 2 — Workflow lifecycle + event log

**Goal**: make workflow state machine real and auditable.

- **Scope**
  - Lifecycle: `Draft → Research → Plan → Pulsing → Review → (Merged | Abandoned) → Closed`.
  - Append-only event log; large payloads stored as artifacts.
- **Exit criteria**
  - State transitions are validated; event log is immutable (corrections are new events).

### Milestone 3 — Shadow Branching: branch + worktree

**Goal**: isolate execution from the user’s working directory.

- **Scope**
  - On entering Pulsing: create workflow branch + `git worktree` under `.autarch/worktrees/<workflow-id>/…`.
  - Worktree lifecycle tracking (registry in DB).
- **Exit criteria**
  - Worktree operations are reliable on Windows/macOS/Linux.
  - No “mysterious dirty main working directory” incidents.

### Milestone 4 — Pulse contract (runner thin slice)

**Goal**: prove the pulse boundary + evidence pipeline end-to-end.

- **Scope**
  - Pulse start/end events.
  - Pulse-end must create:
    - checkpoint commit SHA
    - diff artifact
    - initiating message range reference
  - Queue user messages during pulse; append at pulse end with annotation.
  - Crash/Stop recovery: if dirty, create recovery checkpoint commit.
- **Exit criteria**
  - Can run 5 pulses in a row; each ends in a checkpoint commit; a forced crash preserves work.

### Milestone 5 — Approvals + consent gates

**Goal**: enforce trust boundaries (especially `shell`, `network`, `share_to_model`).

- **Scope**
  - Tool categories: `repo_read`, `repo_write`, `shell`, `network`, `share_to_model`, `git_safe`, `git_dangerous`.
  - Channel-scoped approvals: one-shot, allow-mode, per-channel overrides.
  - Consent excerpt UX: default last N lines; expandable/editable.
  - Content-based `share_to_model` gating focused on logs/ignored paths/sensitive globs.
- **Exit criteria**
  - It is impossible to run shell/network actions without explicit approval under default settings.
  - `share_to_model` never sends raw logs/ignored/sensitive content without approval.

### Milestone 6 — Review Card + Markdown export

**Goal**: local PR semantics that are legible.

- **Scope**
  - Explicit “Request Review” action.
  - Review Card anchored in Stream.
  - Primary diff range:
    - `[base branch OR last Review Card anchor] → [last pulse checkpoint commit]`
  - Markdown export (non re-importable in v0).
- **Exit criteria**
  - Review Card can be generated repeatedly and remains stable/incremental across multiple review cycles.

### Milestone 7 — Merge + Close + Knowledge Review

**Goal**: finish the wedge: merge + durable memory.

- **Scope**
  - Explicit merge proposal; pulse-preserving merge into base.
  - Merge commit uses Conventional Commits.
  - Close channel makes it read-only.
  - Knowledge Review default-on at close (skippable).
  - Pins + close-time extraction (can be stubbed early, improved later).
- **Exit criteria**
  - Can complete the full core loop 3 times in a row on a real repo.
  - Close produces at least 1 useful knowledge item with provenance.

### Milestone 8 — v0 dogfood hardening

**Goal**: make it usable for daily work.

- **Scope**
  - Worktree repair/cleanup tooling.
  - Better failure UX (recover, resume semantics, clear error causes).
  - Minimal search over finalized knowledge (tags + FTS).
- **Exit criteria**
  - “Golden scenario” can be executed weekly without babysitting.

---

## Next: v1 (Team Cloud) — multiplayer Stream + shared continuity

v1 begins after v0 wedge is validated locally.

### v1-A — Cloud Mode canonical Stream + knowledge

- **Goal**: shared channels, shared review artifacts, shared L3 knowledge.
- **Scope**
  - Cloud-authoritative DB + event log.
  - Channel-scoped ACLs; Owner/Member roles.
  - Online-required contract.
  - Cloud model gateway (org-managed keys; supports Autarch-billed + org-billed).
- **Key decisions to preserve**
  - Approvals remain first-class (now also audit).
  - Cloud retains in-flight diffs while workflows are open; purge bulky artifacts on close; retain metadata.

### v1-B — Team Telepathy (portable links)

- **Goal**: connect code to reasoning across clones/machines.
- **Scope**
  - Standardized Git trailers on pulse commits + merge commits.
  - Deep-link from IDE/GUI into the Stream using trailer IDs.

### v1-C — Lightweight IDE bridge

- **Goal**: reduce alt-tab tax.
- **Scope**
  - Deep-links from editor to channel/workflow.
  - “Send selection/context” to the Stream under the same consent model.

---

## Later: v2+ (Always-On execution, deeper intelligence)

### v2-A — Always-On Sandbox (remote execution)

- **Goal**: let agents finish long refactors while your laptop is closed.
- **Scope**
  - Remote execution VM per workflow.
  - Stronger data egress controls and retention.

### v2-B — Richer retrieval and search

- **Goal**: higher recall without indexing “everything risky.”
- **Possible scope**
  - Embeddings over finalized knowledge (deeper) + better ranking.
  - Optional, opt-in semantic search over selected code areas.
  - More powerful provenance navigation (“dig deeper” flows).

### v2-C — Workflow graphs and stacking

- **Goal**: support larger efforts without losing explainability.
- **Possible scope**
  - Workflow dependency DAG.
  - Stacked branches (carefully; preserve 1:1 mental model as default).

---

## Cross-cutting “kill/iterate” signals

If these stay bad after iteration, pause expansion and fix core loop:

- **Core loop completion rate** (workflow created → merged → closed).
- **Approvals friction** (approvals per pulse; abandon rate after prompts).
- **Pulse reliability** (checkpoint commit success rate; crash recovery frequency).
- **Review clarity** (time from Request Review → merge/abandon; user edits to summaries).
- **Worktree issues** (orphan frequency; cleanup failures; user working dir pollution).

---

## Roadmap dependencies (high level)

- v0 Milestones 0–2 are prerequisites for everything.
- v0 Milestone 3 (worktrees) is a prerequisite for safe background execution and for “no workspace disruption” trust.
- v0 Milestones 4–7 together validate the wedge; do not start v1 until these are stable.
- v1 Cloud Mode depends on a stable event model (v0 Milestone 2) and artifact strategy.
