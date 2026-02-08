# Autarch — Product Thinking

This document distills durable product thinking from prior design documents. It captures the target persona, core workflow loop, knowledge model, product invariants, and channel close semantics that define Autarch's product surface — independent of any particular implementation technology.

---

## Target Persona & Product Positioning

**Vision:** Enable a solo developer to operate with the leverage of a 10-person team by using "Workflows" instead of "Tickets," then extend that leverage to teams by making reasoning and work-in-flight legible and durable (reducing bus factor and tribal knowledge).

**Target User:** The "Architect-Builder" — the workflow execution owner who uses the agent as the primary execution arm, plus collaborators (channel members and reviewers) who consume the Stream, Review Cards, and durable knowledge to reduce bus factor.

**Wedge:** Threaded workflows that map 1:1 to Git branches, executed in checkpointed agent pulses, ending in a local Review Card and pulse-preserving merge (Team Telepathy).

**Core Philosophy:**

- **Repo-Ownership:** The tool is Git-native; code state is repository state.
- **Team Telepathy:** Linking every line of code back to the Stream where it was "born," including agent reasoning and human approval.
- **Stream-of-Consciousness PM:** Management happens through conversation, not form-filling.
- **Stream-first UI, Git truth:** The Stream is the primary surface; Git remains the canonical source of code state.

---

## The Core Loop

The core loop is the single workflow Autarch must repeatedly complete end-to-end. If this loop works reliably on a real repo, the product works.

1. **Open repo / create project** — Select a base branch (default `main`).
2. **Create a Workflow channel** — Channel maps 1:1 to a workflow.
3. **Research → Plan (no Git side-effects)** — Gather repo context; produce a bounded plan.
4. **Enter Pulsing** — Create workflow branch. Create isolated worktree for the workflow.
5. **Run a Pulse** — Execute a bounded unit of work. Request approvals when needed at trust boundaries. End the pulse only when a checkpoint commit exists.
6. **Request Review (explicit user action)** — Create a Review Card anchored in the Stream. Primary diff range: `[base branch OR last Review Card anchor] → [last pulse checkpoint commit]`.
7. **Merge (explicit user action)** — Perform a pulse-preserving merge into base branch. Merge commit uses Conventional Commits.
8. **Close channel** — Default-on Knowledge Review (skippable via "Close without knowledge"). Promote 1–3 durable knowledge items with tags and provenance.

### Acceptance Criteria

The core loop is validated when:

- **Isolation:** Pulses never require switching the user's active working directory; work happens in a worktree.
- **Durability:** Every pulse ends in a checkpoint commit; crashes and stops preserve work as a recovery checkpoint.
- **Legibility:** The Review Card is sufficient for a human to decide merge/no-merge without reconstructing context manually.
- **Trust gates:** Approvals reliably gate `shell`, `network`, `git_dangerous`, and sensitive `share_to_model` scenarios.
- **Git-native:** Merge preserves pulse commits (no squash), enabling later "reasoning blame" via history.

---

## Knowledge Model

Autarch captures durable knowledge from workflows so that reasoning, decisions, and patterns survive beyond the conversation that produced them.

### Knowledge Items

A knowledge item is the atomic unit of durable memory. Each item contains:

- **Text** — the knowledge content itself.
- **Tags** — namespaced labels for categorization (e.g., `feature:auth`, `pattern:error-handling`, `stack:postgres`).
- **Provenance** — a link back to the originating channel, the specific message range where the knowledge emerged, and any associated commit SHAs. This enables tracing any knowledge item back to the conversation and code that produced it.
- **Status** — either draft (proposed, not yet confirmed) or finalized (promoted through Knowledge Review).

### Pins (User-Initiated Capture)

During a workflow or discussion, a user can **pin** a piece of knowledge — explicitly marking a message, decision, or pattern as worth preserving. Pins are the user-initiated path to knowledge capture.

### Close-Time Extraction (System-Proposed Capture)

When a channel closes, the system proposes candidate knowledge items extracted from the conversation. The user reviews, edits, tags, and promotes these candidates during the Knowledge Review step. The system may continuously draft candidate items throughout a conversation, but promotion to finalized status is gated by Knowledge Review.

### Provenance Model

Every knowledge item records its provenance: the channel where it originated, the message range that contains the relevant discussion, and any commit SHAs associated with the work. This provenance model enables **"dig deeper"** — following links from a knowledge item back into the originating channel to recover full context when the summary alone is insufficient.

### Namespaced Tags

Tags use a namespace convention to support structured retrieval:

- `feature:*` — domain or feature area (e.g., `feature:auth`, `feature:billing`)
- `pattern:*` — recurring code or design patterns (e.g., `pattern:retry-logic`)
- `stack:*` — technology or infrastructure (e.g., `stack:postgres`, `stack:redis`)

---

## Product Invariants

These invariants must not break. They define the trust boundaries and correctness guarantees of the system.

### Source-of-Truth Rules

- **Code truth:** Git commits and branches are durable truth; pulse-end commits are canonical checkpoints.
- **Workflow truth:** Workflow state machine and append-only event log are canonical in the project database.
- **Knowledge truth:** Knowledge items are canonical; exports (e.g., Markdown) are derivative.

### Pulse Invariants

- A pulse **ends only** when a checkpoint commit exists.
- Pulse-end evidence includes:
  - Checkpoint commit SHA
  - Diff artifact ID
  - Initiating message range (message IDs + revision IDs)
- Tests are required **only when explicitly requested** by the user or the plan for that pulse.

### Safety and Consent Invariants

- No raw logs, environment variables, or secrets are sent to any model without explicit approval (content-based gating).
- The default excerpt for approvals is the **last N lines**, expandable and editable by the user.
- Approvals are **channel-scoped**.

---

## Channel Close & Knowledge Review

### Close Semantics

When a workflow channel is merged or abandoned, the channel closes and becomes **read-only**. No further messages, pulses, or Git operations occur in a closed channel.

Discussion channels (which have no branch or pulse activity) also close and become read-only, but skip the merge step since they have no associated branch.

### Knowledge Review (Default-On)

Knowledge Review runs by default when any channel closes — both Workflow and Discussion channels. The user may skip it via "Close without knowledge."

During Knowledge Review, the user:

- Reviews system-proposed knowledge items extracted from the conversation.
- Edits text and assigns namespaced tags.
- Promotes 1–3 durable knowledge items with full provenance (channel, message ranges, commit SHAs).

### Design Intent

Close should produce at least one useful knowledge item with provenance. This is the bar for a successful Knowledge Review — the system should make it easy to capture something worth remembering from every meaningful conversation.
