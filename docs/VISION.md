> NOTE: This document is from a previous iteration and _may_ be outdated.

# Autarch – The Context-First Development OS

## 1. Vision & Strategy

**Vision:** Enable a solo developer to operate with the leverage of a 10-person team by using "Workflows" instead of "Tickets," then extend that leverage to teams by making reasoning and work-in-flight legible and durable (reducing bus factor and tribal knowledge).
**Target User:** The "Architect-Builder" (workflow execution owner) who uses the native **Autarch Agent** as the primary execution arm, plus their collaborators (channel members/reviewers) who consume the Stream, Review Cards, and durable knowledge to reduce bus factor.
**Wedge (v0):** **Threaded workflows that map 1:1 to Git branches, executed in checkpointed agent pulses, ending in a local Review Card + pulse-preserving merge (Team Telepathy).**
**Core Philosophy:** * **Repo-Ownership:** The tool is Git-native; **code state is repository state**.
* **Team Telepathy:** Linking every line of code back to the Stream where it was "born," including agent reasoning and human approval.
* **Stream-of-Consciousness PM:** Management happens through conversation, not form-filling.
* **Stream-first UI, Git truth:** The Stream is the primary surface; Git remains the canonical source of code state.
* **Portability stance (v0):** Canonical state lives in Autarch’s local project DB; provide **Markdown export** for Review Cards; structured/re-importable exports are deferred.
* **Workflow truth (v0):** Workflow state + memory are canonical in the **project DB** (with Git as evidence and durable checkpoints). In Cloud Mode (team), canonical workflow state moves to a secure cloud DB.

---

## 2. Core Product Architecture

### 2.1. The "Repo-Owner" Model

Autarch does not just "read" your code; it manages it.

* **Shadow Branching (v0):** A workflow branch is created when the workflow enters **Pulsing** (Draft/Research/Plan have no Git side-effects by default). Implementation goal: the workflow runs in a **separate shadow workspace** so pulses can execute without touching the user’s active working directory.
* **Time-Travel (v0):** Rewind is **git-native via forked timelines** (no filesystem snapshot dependency): you can fork the workflow branch from any prior checkpoint commit.
* **Automated Commits (v0):** Pulses end in **checkpoint commits** on the workflow branch; the base branch history preserves these pulses via a merge commit to enable "Team Telepathy" (linking code to reasoning).

### 2.2. The Interface: "The Stream" (Slack-like Workflow)

Instead of a Kanban board, Autarch uses a **Threaded Workspace** where each agentic workflow has a dedicated channel.

* **v0 scope:** A workflow/channel is tied to **one repo** and maps to **one workflow branch** (no stacked workflows in v0).
* **Cloud Mode (team):** Channels have **member-based access control**, and workflows assume a **single execution owner** (one person runs pulses/merges) while others collaborate via messages + review.
* **#scoping-room:** A channel where you "vibe-code" the roadmap. The AI (Product Agent) listens and generates the **Task DAG** in the background.
* **#feature-auth-logic:** A channel for a specific build. It contains the code diffs, the agent's thought process, and your feedback.
* **Discussion channels:** Some channels are explicitly “no-work” spaces (no pulses/branch) used to think, research, and make decisions. When closing, the channel runs a **Knowledge Review** step to publish durable knowledge items into the Context Fabric.
* **Review Cards:** Requesting review creates a structured, anchored “review artifact” (plan/pulses/tests + key discussion) without requiring a remote-hosted PR. The system should be proactive: it **prepares** Review Card drafts and **proposes** review when the workflow evidence is ready; the user remains the final approver of “Request Review” and merge.
  - **Diff anchor (v0):** The Review Card’s primary diff is **`[base branch OR last Review Card anchor] → [last pulse checkpoint commit]`**.

### 2.3. Deployment: Local-First, Hybrid-Ready

* **Local Daemon:** All indexing (Vector/Graph) and Git management happens on your machine.
* **Two project modes:**
  - **Local Mode (v0):** Canonical project DB is local (`.autarch/`), local-only review/merge semantics.
  - **Cloud Mode (team):** Canonical project DB lives in a secure cloud service, enabling shared Stream + knowledge + in-flight review. Pulses still execute locally (v1), but state is cloud-authoritative.
  - **Cloud Mode invariants (v1):**
    - Online-required (not offline-first).
    - In-flight code artifacts (raw diffs) are retained while workflows are open; on close, purge bulky artifacts and retain metadata + curated knowledge.
    - LLM calls are proxied via Autarch Cloud (multi-provider), using **org-managed keys** configured in the UI. (In some plans Autarch provides the keys; in others the org supplies vendor keys so developers don’t manage credentials.)
    - Approvals (`share_to_model`, etc.) are UX + audit within Autarch’s toolchain; access control + auditability become primary trust boundaries in Cloud Mode.
* **Hybrid Cloud (Roadmap):**
  - **Always-On Sandbox (later):** Offload Autarch Agent execution to a cloud VM so agents can finish complex refactors while your laptop is closed.

---

## 3. The "Pulse" Model: Middle-Ground Interaction

To solve the **Sync vs. Async** dilemma, Autarch uses **"Pulse Execution."**

At a high level, a workflow alternates between **thinking stages** and **execution stages**:

* **Research:** Assemble context and constraints from the repo + knowledge.
* **Plan:** Convert that context into a concrete, reviewable action plan.
* **Pulse:** Execute one bounded chunk of work with a durable checkpoint.

**Invariant (v0):** A Pulse ends in a **checkpoint Git commit** on the workflow branch (and associated evidence artifacts), enabling rewind and Review Card diffs without polluting the base branch.

---

## 4. System Components & Integration

### 4.1. The Autarch Agent (Native Execution)

*   **Native Engine:** Autarch implements a native C# agent (`Autarch.Agent`) that is "Context-Aware" by default, with direct access to the project database and knowledge graph via internal service calls.
*   **Internal Services:** The Avalonia GUI and the agent share the same process and communicate via in-process service interfaces. This enables zero-latency tool approvals and structured event streaming without IPC overhead.
*   **Safety by Design:** Because the agent is embedded, Autarch can physically pause the execution loop for **Guarantee A** consent gates (approving shell output, network access, or sharing sensitive files) before the LLM ever sees the data.
* **IDE integration (v0+):** Autarch remains a standalone orchestrator (not an editor fork). To reduce the “alt-tab tax,” provide a lightweight editor bridge (extension) that can deep-link into Autarch channels and send focused context (e.g., current file/selection) under the same consent/permissions model.
* **Model Plugin:** Users can configure model selection **by workflow stage** (e.g., Research/Plan/Pulsing/Review): use `gpt-4o` for Research/Planning and `claude-3.5-sonnet` for Building, or local `llama3` for Research.

### 4.2. Data Ingestion & Memory (The Context Fabric)

* **L1 (Active):** The current thread's history and active file ASTs.
* **L2 (Structural):** The Graph of your repo (which file calls which).
* **L3 (Permanent):** Finalized **knowledge items** (pins + close-time extraction) are indexed with **tags** + provenance. The system may **continuously draft** candidate knowledge items throughout a thread, but promotion to L3 is gated by close-time Knowledge Review. If you ask a year from now, *"How did we handle Stripe errors?"*, Autarch retrieves the relevant knowledge items first, and can “dig deeper” by following provenance links back into the **#feature-stripe** thread when needed.

---

## 5. Functional Requirements (MVP)

| ID | Feature | Description |
| --- | --- | --- |
| **FR-01** | **Thread-to-Git** | Creating a channel creates a branch; requesting review creates a Review Card; closing a channel performs (or finalizes) a **local** pulse-preserving merge. |
| **FR-01a** | **Project Creation + Open Repo (v0)** | v0 supports creating new Autarch-managed projects **and** opening existing Git repos (base branch selected on open; default `main`). |
| **FR-02** | **Pluggable Models** | UI to toggle between OpenAI, Anthropic, and Ollama per channel. |
| **FR-03** | **Pulse Control** | Settings to define checkpoints + approvals (e.g., **ask before every shell command**; **network off by default**). |
| **FR-04** | **Semantic Search** | Search across finalized knowledge + code. v0: tags + SQLite FTS, with optional embeddings over finalized knowledge items (provenance enables “dig deeper” into threads). |
| **FR-05** | **Agent Mentions** | `@scoper break this down` or `@builder implement this` within a thread. |

---

## 6. Commercial Strategy (The "Fun to Profit" Path)

1. **Tier 1 (Free/OSS):** **Local Mode**. Local-only. Use your own API keys. Own your repo.
2. **Tier 2 (Team Cloud - SMB/Startup):** **Cloud Mode** (remote-canonical Stream/knowledge/review) with **Autarch-proxied LLM calls** and **Autarch-managed keys** for easiest setup. **Consumption-based billing** (likely seat + usage). In-flight code artifacts are retained while workflows are open; on close, keep metadata + curated knowledge.
3. **Tier 3 (Enterprise/Regulated):** **Cloud Mode** with **Autarch-proxied LLM calls** but **org-managed vendor keys** (configured once; no per-dev setup), plus enterprise controls. Pricing is unpublished / sales-led.
4. **Tier 4 (Enterprise/Hardcore - Usage-based):** Integrated Cloud Sandboxes (Always-On execution) + deeper enterprise controls.
