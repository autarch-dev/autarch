# Autarch

Autarch is a local development tool that gives a solo developer the leverage of a small team. Instead of tickets and task boards, you work in **Workflows** — threaded conversations tied to Git branches — where every decision, line of reasoning, and approval lives right next to the code it produced.

<img width="1861" height="991" alt="image" src="https://github.com/user-attachments/assets/4016ddfb-bd92-447c-bd74-fcc3aecf650f" />

## The Problem

AI coding assistants are genuinely useful, but fitting them into the way you actually work is still rough. Context disappears between conversations. The reasoning behind decisions ends up scattered across chat logs, notes, and your own memory. You either watch over every action or come back to a codebase you don't recognize.

Autarch brings structure to AI-assisted development so it's **traceable, reversible, and safe**.

## What You Get

**Workflows instead of tickets.** Each workflow is a conversation thread backed by a Git branch. You describe what you want; Autarch's agents handle the research, planning, execution, and review.

**Checkpointed work.** Everything happens in bounded "pulses" that each end in a Git commit. You can stop, rewind, or branch off at any checkpoint — no mystery states.

**Review cards.** When work is done, you get a structured summary of what changed, why it changed, and the reasoning behind each decision. Think of it as local PR review without needing a hosted service.

<!-- TODO: Add screenshot of the stream-first interface showing a workflow channel with review card -->

**Full traceability.** Every line of code links back to the conversation where it was written. `git blame` shows you not just *who*, but *why* — including the AI's reasoning and your approvals.

**Knowledge that sticks around.** When you close a workflow, Autarch pulls out the important bits — decisions, patterns, trade-offs — and stores them with provenance. Ask "how did we handle rate limiting?" months later and get a real answer.

**Safe by default.** Shell commands and sensitive operations require your explicit approval. Content gating keeps secrets away from AI models. A shadow workspace isolates execution so your working directory is never disrupted. More on this in [How It Works](docs/HOW_IT_WORKS.md).

**Two kinds of channels.** *Workflow channels* follow a feature from draft to merged code. *Discussion channels* are for research and decisions that don't involve code changes. Both capture knowledge when you close them.

## How a Workflow Works

1. **Start a workflow** — open a new channel for a feature, bug fix, or exploration.
2. **Research and plan** — the agent gathers context and builds a concrete plan. No code changes yet.
3. **Pulse** — execute a bounded chunk of work with a checkpoint commit at the end. Approve any sensitive actions along the way.
4. **Review** — generate a review card with diffs, reasoning, and evidence.
5. **Merge** — a pulse-preserving merge keeps the full history for future traceability.
6. **Close** — extract knowledge items so the decisions and patterns are captured for good.

For the full lifecycle walkthrough — approval gates, rewind mechanics, the quick-path variant — see [How It Works](docs/HOW_IT_WORKS.md).

## Roadmaps

Autarch can also help you figure out *what to build next*. The Roadmap feature generates an actionable, codebase-aware plan for your project by running four AI "personas" in parallel, each analyzing your code through a different lens:

- **The Visionary** thinks about what your product *could become* — platform potential, ambitious ideas, product identity.
- **The Iterative** focuses on what to ship *next* — quick wins, user-facing friction, and the best bang for your effort.
- **The Tech Lead** looks at what the code *actually needs* — tech debt, test coverage gaps, scalability risks, dependency health.
- **The Pathfinder** finds what the others missed — leverage plays, convergence points, and two-birds-one-stone opportunities.

Each persona independently explores your codebase, may ask you clarifying questions, and produces a full roadmap proposal. Once all four are done, a synthesis agent reads every proposal, surfaces agreements and disagreements, and works with you to resolve trade-offs — producing a single unified roadmap that's more complete and realistic than any single perspective could manage.

The result is a vision document, ordered milestones, and sized initiatives you can start executing immediately. Initiatives link directly to Autarch workflows, so there's a clean bridge from "what should we build?" to "let's build it." The whole thing is fully editable after generation — you own the output and can restructure it however you like.

## Getting Started

Autarch runs entirely on your machine. Your code stays local, you bring your own API keys, and there's no cloud dependency.

```bash
# Point Autarch at your project
autarch /path/to/your/project
```

The onboarding wizard walks you through API key setup and model configuration. From there, create your first workflow and you're off.

**[Full setup guide →](GETTING_STARTED.md)**

## Architecture

Everything runs locally with a **local-first, cloud-ready** design. An event-sourced architecture opens the door to future team sync, portable Git trailers keep traceability intact across clones, and review cards export cleanly for collaboration without lock-in.

For the full system design — agent pipeline, database architecture, frontend structure — see [Architecture](ARCHITECTURE.md).

## Project Status

Autarch is in active development. Right now the focus is on validating the core loop end-to-end:

> Workflow → Research/Plan → Checkpointed pulses → Review Card → Merge → Knowledge extraction

## Docs

- **[Getting Started](GETTING_STARTED.md)** — Installation, setup, and your first workflow
- **[How It Works](docs/HOW_IT_WORKS.md)** — Workflow lifecycle, approval gates, and knowledge extraction
- **[Product Thinking](docs/PRODUCT.md)** — Target persona, core loop, knowledge model, and product invariants
- **[Architecture](ARCHITECTURE.md)** — System design, data model, and technical deep-dive

## Project Roadmap

Below is a roadmap for Autarch, generated by Autarch. Subject to change.

### vNext

**Status:** Active

#### Polish & Foundation

| Title | Status | Priority | Size | Dependencies |
| --- | --- | --- | --- | --- |
| Add search/filter to Completed Workflows page | Completed | Critical | 2 | — |
| Add summary stats header to Completed Workflows | Completed | High | 2 | — |
| Add sort options to Completed Workflows | Not Started | Medium | 1 | — |
| Add helpful empty states across all major views | Completed | High | 3 | — |
| Add React error boundaries at feature boundaries | Completed | High | 3 | — |
| WebSocket auto-reconnection with exponential backoff | Completed | High | 3 | — |
| Add lightweight CI pipeline (test + lint gates) | Completed | High | 2 | — |
| Add health check endpoint | Not Started | Medium | 1 | — |
| Fix discussion toolbar formatting buttons | Completed | Medium | 2 | — |

#### Close the Knowledge Loop

| Title | Status | Priority | Size | Dependencies |
| --- | --- | --- | --- | --- |
| Close the knowledge loop: agent context injection | Not Started | Critical | 5 | — |
| Knowledge relevance scoring and context window management | Not Started | High | 5 | Close the knowledge loop: agent context injection |
| Knowledge Management API routes | Completed | High | 3 | — |
| Knowledge Management UI | In Progress | High | 8 | Knowledge Management API routes |

#### Decompose the WorkflowOrchestrator

| Title | Status | Priority | Size | Dependencies |
| --- | --- | --- | --- | --- |
| Extract GitWorkflowManager from WorkflowOrchestrator | Not Started | High | 5 | — |
| Extract ArtifactManager from WorkflowOrchestrator | Not Started | Medium | 5 | — |
| Extract StageTransitionManager from WorkflowOrchestrator | Not Started | Medium | 8 | Extract GitWorkflowManager from WorkflowOrchestrator, Extract ArtifactManager from WorkflowOrchestrator |
| Expand test coverage for extracted modules | Not Started | High | 5 | — |

#### GitHub Integration Hub

| Title | Status | Priority | Size | Dependencies |
| --- | --- | --- | --- | --- |
| GitHub PR auto-creation from completed workflows | Not Started | Critical | 8 | — |
| GitHub Issues as workflow input | Not Started | High | 8 | — |
| Commit and branch linking to issues | Not Started | Medium | 3 | — |
| Server-side event subscriber infrastructure | Not Started | Medium | 3 | — |

#### Earned Trust & Proactive Intelligence

| Title | Status | Priority | Size | Dependencies |
| --- | --- | --- | --- | --- |
| Work pattern familiarity scoring | Not Started | Critical | 8 | — |
| Adaptive checkpoint gating | Not Started | High | 8 | Work pattern familiarity scoring |
| Autonomy confidence dashboard | Not Started | High | 5 | — |
| Background knowledge analysis engine | Not Started | Medium | 8 | — |
| Active notification system for codebase concerns | Not Started | Medium | 8 | Background knowledge analysis engine |
