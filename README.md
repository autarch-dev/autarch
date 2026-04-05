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

## Agent Backends

Autarch supports two ways to run its AI agents:

**API** — Autarch calls LLM providers directly (Anthropic, OpenAI, Google, AWS Bedrock, etc.). You bring your own API keys and configure which model each agent role uses. Pay per token.

**Claude Code** — Autarch delegates to a locally installed [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI. Autarch's unique tools (semantic search, workflow lifecycle, code review, etc.) are exposed via MCP, while Claude Code handles file I/O, search, and conversation management natively. Requires the Claude Code CLI to be installed and authenticated.

You choose the backend during onboarding or in Settings. Both backends support the full workflow lifecycle — scoping, research, planning, execution, and review.

## Getting Started

Autarch runs entirely on your machine. Your code stays local and there's no cloud dependency.

```bash
# Point Autarch at your project
autarch /path/to/your/project
```

The onboarding wizard walks you through backend selection and configuration. From there, create your first workflow and you're off.

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
