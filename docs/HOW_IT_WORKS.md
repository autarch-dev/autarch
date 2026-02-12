# Autarch — How It Works

This document walks through the concrete lifecycle a user experiences when working with Autarch. It covers every stage a workflow passes through, how approval gates give the user control, how git worktrees provide isolation, and how knowledge is preserved after completion. For product vision, invariants, and the knowledge model, see PRODUCT.md.

---

## The Mental Model

A **Workflow** is Autarch's unit of work, mapping one-to-one to a git branch. Each workflow progresses through a sequence of stages — from initial scoping through research, planning, execution, and review — ending in a merge and knowledge capture.

The user acts as the **decision-maker** at key gates between stages. Agents handle the execution within each stage, producing artifacts for the user to review. The user never writes the code, research, or plan directly — they approve, request changes, or redirect.

Within execution, a **Pulse** is a bounded unit of code change. Each pulse produces a checkpoint commit. A workflow's plan may contain one pulse or many, but each pulse is independently compilable and represents a coherent piece of work.

---

## The Full-Path Lifecycle

The full path takes a workflow through all seven stages. This is the default for complex, risky, or exploratory work where codebase understanding and careful planning matter.

### Backlog

The workflow exists but hasn't started. It was created from a channel or a roadmap item. The user can prioritize, reorder, and describe the intent, but no agent work has begun.

### Scoping
<img width="1479" height="1100" alt="image" src="https://github.com/user-attachments/assets/ee8fe2fe-62be-40b4-bd5c-fc96178aea04" />

A **scoping agent** refines the user's intent into a structured **scope card**. Scoping works iteratively to expand and contract the scope as necessary, identify gaps, ask the user clarifying questions, and establish a clear scope boundary, presented as a scope card. The scope card captures:

- **Title** — a concise name for the work.
- **Description** — what the workflow accomplishes.
- **In-scope** — what is included.
- **Out-of-scope** — what is explicitly excluded.
- **Constraints** — any boundaries or requirements.
- **Recommended path** — whether the agent suggests quick or full path, with rationale.

The user reviews the scope card and can approve it (choosing quick or full path), request changes (the agent revises), or reject it.

### Researching
<img width="1479" height="1100" alt="image" src="https://github.com/user-attachments/assets/4c042fc4-33fa-4805-aa3c-1c665768d545" />

A **research agent** explores the codebase to understand patterns, integration points, dependencies, and potential challenges. It produces a **research card** containing:

- **Summary** — high-level findings.
- **Key files** — the files most relevant to the work.
- **Patterns** — coding conventions and structural patterns observed.
- **Integration points** — where the new work connects to existing code.
- **Challenges** — potential pitfalls and mitigations.
- **Recommendations** — suggested approaches based on the exploration.

The user reviews the research card and can approve, request changes, or rewind to scoping.

### Planning
<img width="1479" height="1100" alt="image" src="https://github.com/user-attachments/assets/324290fc-7548-4f90-9062-9a75e76674c1" />

A **planning agent** designs the implementation as an ordered list of pulses. Each pulse in the **plan** is bounded and independently compilable — it has a title, description, expected changes, and estimated size. The sequence is designed so each pulse builds on the last.

The user reviews the plan and can approve, request changes, or rewind to research or scoping.

### In Progress

Execution happens in two phases.

**Preflight** — A preflight agent sets up the environment in the workflow's isolated worktree. It installs dependencies, verifies the build compiles, runs the linter, and records baselines. These baselines let pulse agents know which errors existed before their changes versus which ones they introduced. Preflight completion automatically starts the first pulse — no user approval is needed.

**Pulse execution** — Pulses execute sequentially in plan order. Each pulse gets its own sub-branch off the workflow branch, makes its changes, and ends with a checkpoint commit. When a pulse completes, its sub-branch is fast-forward merged into the workflow branch and deleted. The next pulse then begins.

When the last pulse completes, the workflow automatically transitions to review — no user approval is needed.

### Review

A **review agent** analyzes all changes across the workflow, producing a **review card** with:

- **Summary** — what was built and why.
- **Comments** — file-level and line-level analysis with severity and category.
- **Recommendation** — approve, deny, or flag for manual review.

The user reviews the review card and can approve (triggering a merge), request changes (the agent addresses feedback), or rewind to an earlier stage.

#### Merge Mechanics

When the user approves the review, they choose a **merge strategy** for combining the workflow branch into the base branch:

- **Fast-forward** — moves the base branch pointer forward. Only works if the base branch hasn't diverged.
- **Squash** — collapses all pulse commits into a single commit on the base branch.
- **Merge-commit** — creates a merge commit that preserves all individual pulse commits in history. This is the default.
- **Rebase** — replays pulse commits onto the base branch tip, then fast-forwards.

The default **merge-commit** strategy preserves individual pulse commits, enabling later "reasoning blame" — tracing any line of code back through its pulse to the conversation and decisions that produced it.

Every merge includes **commit trailers** that link commits back to their workflow:

- **Autarch-Workflow-Id** — the unique workflow identifier.
- **Autarch-Workflow-Name** — the human-readable workflow title.

After the merge completes, the workflow's worktree is removed and the workflow branch is deleted. The code now lives on the base branch.

### Done

The workflow is complete. The channel becomes read-only. **Knowledge extraction** fires in the background to preserve reusable insights from the work (see the Knowledge Extraction section below).

---

## The Quick Path

The quick path is a distinct variant for small, well-understood changes where research and planning would add overhead without value.

### Sequence

Scope → preflight → single pulse → review → done.

When the user approves a scope card, they choose **quick** or **full** path. The quick path skips research and planning entirely — the full scope card becomes the single pulse's description. From there, the same preflight → pulse → review → done flow applies.

### When to Use Each Path

- **Quick path** — the change is small, the approach is obvious, and the relevant code is well-known. Examples: fixing a typo, adding a field, updating a dependency.
- **Full path** — the work is complex, risky, or requires codebase exploration before implementation. Examples: adding a new feature, refactoring a subsystem, integrating with an unfamiliar module.

The scoping agent recommends a path based on the scope card's complexity, but the user always makes the final decision.

---

## Git Worktree Isolation

Your working directory is never disrupted. You can continue working on your own branch while Autarch works in parallel.

### The Mechanism

Each workflow gets its own **isolated worktree** — a full working copy of the repository — at `.autarch/worktrees/{workflowId}`. The worktree lives on its own branch, `autarch/{workflowId}`, created from the base branch at the time execution begins.

Within execution, each pulse gets a **sub-branch** off the workflow branch. The pulse agent works exclusively on this sub-branch. When a pulse completes its checkpoint commit, the sub-branch is fast-forward merged into the workflow branch and deleted.

This means:

- **No branch switching** — the user's checkout is untouched throughout the workflow.
- **No file conflicts** — Autarch's changes happen in a separate directory tree.
- **Parallel work** — multiple workflows can run simultaneously, each in its own worktree.
- **Clean merges** — the workflow branch is merged into the base branch only at the end, after review and approval.

---

## Approval Gates

Four explicit gates require user approval before a workflow advances. These are the user's primary control mechanism — nothing progresses without their sign-off at each boundary.

### Scope Approval

After scoping completes. The user reviews the scope card and can:

- **Approve** — choosing quick or full path. This is the only gate where the path decision is made.
- **Request changes** — the scoping agent revises the scope card.
- **Reject** — the workflow does not proceed.

### Research Approval

After research completes (full path only). The user reviews the research findings and can:

- **Approve** — proceed to planning.
- **Request changes** — the research agent revises its findings.
- **Rewind to scoping** — rethink the scope before researching again.

### Plan Approval

After planning completes (full path only). The user reviews the pulse plan and can:

- **Approve** — proceed to execution.
- **Request changes** — the planning agent revises the plan.
- **Rewind to research or scoping** — go back to an earlier stage.

### Review Approval

After review completes. The user reviews the changes and can:

- **Approve and merge** — choose a merge strategy and complete the workflow.
- **Request changes** — the agent addresses the feedback.
- **Rewind to research, planning, or execution** — go back to an earlier stage.

### Auto-Transitions

Two transitions require **no user approval** and happen automatically:

- **Preflight → first pulse** — when preflight completes successfully, the first pulse starts immediately.
- **Final pulse → review** — when the last pulse completes its checkpoint commit, the workflow transitions directly to review.

These auto-transitions keep execution moving without unnecessary interruptions. The user's next decision point is the review gate, where they evaluate the complete result.

---

## Rewind

Rewind is iterative refinement, not failure. At approval gates, the user can send a workflow back to an earlier stage when the current result isn't right — whether the approach was wrong, the plan was too broad, or the execution missed the mark.

### Rewind Targets

- **Rewind to research** — rethink the approach. Clears research, plan, and review artifacts. Restarts research with the approved scope card as context.
- **Rewind to planning** — redesign the implementation. Keeps research, clears plan and review artifacts. Restarts planning with scope and research as context.
- **Rewind to execution** — redo the work. Keeps scope, research, and plan. Clears execution results and review. Cleans up the worktree and branch, then starts fresh from preflight.
- **Rewind to review** — re-examine the changes. Keeps all execution results intact with no git cleanup. Restarts only the review process.

### Key Principle

Earlier artifacts are always preserved. Later artifacts are cleared. A fresh agent session starts at the target stage, inheriting the context of everything that came before it. This means the agent benefits from prior work without being constrained by prior mistakes.

---

## Knowledge Extraction

After a workflow completes, an LLM analyzes the workflow's artifacts to extract reusable knowledge. This happens in the background and never blocks workflow completion — if extraction fails, the workflow is still done.

### What Gets Analyzed

The extraction process examines the workflow's session notes, research card, review card, and scope card to identify insights worth preserving.

### Knowledge Categories

Extracted items fall into four categories:

- **Patterns** — reusable code patterns, architectural decisions, or structural approaches that proved effective.
- **Gotchas** — pitfalls to avoid, unexpected behaviors, or edge cases discovered during the work.
- **Tool-usage** — tips for working with specific tools, libraries, or frameworks encountered in the codebase.
- **Process improvements** — workflow insights about how to approach similar work more effectively.

### Storage and Retrieval

Each knowledge item is stored with **embeddings** for semantic retrieval. When future workflows enter the research or planning stages, relevant knowledge items surface automatically — connecting past experience to present work.

For the broader knowledge model — including pins, tags, provenance, and close-time extraction — see PRODUCT.md.
