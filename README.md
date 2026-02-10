# Autarch

**The Context-First Development OS**

Autarch gives a solo developer the leverage of a 10-person team. It replaces tickets with **Workflows** — threaded conversations that map directly to Git branches — so every decision, approval, and line of reasoning lives alongside your code forever.

<!-- TODO: Add demo GIF showing the workflow loop (create → scope → research → plan → pulse → review → merge) -->

## Why Autarch

AI coding assistants are powerful, but integrating them into real workflows is messy. Context vanishes between conversations. Decisions live in Slack threads and people's heads. You either babysit every action or return to find your codebase in an unexpected state.

Autarch fixes this by making AI-assisted development **structured, traceable, and safe**.

## Feature Highlights

🔀 **Workflows, Not Tickets** — Each workflow is a threaded channel backed by a Git branch. Describe what you want in conversation; Autarch's agents handle scoping, research, planning, execution, and review.

⚡ **Checkpointed Pulses** — Work happens in bounded pulses that end in a Git commit. Stop, rewind, or fork at any checkpoint. No mystery states.

🔍 **Review Cards** — When work is ready, get a structured review showing what changed, why, and the reasoning behind each decision. Local PR semantics without a hosted service.

<!-- TODO: Add screenshot of the stream-first interface showing a workflow channel with review card -->

🧠 **Team Telepathy** — Every line of code links back to the conversation where it was born. `git blame` shows not just *who*, but *why* — complete with AI reasoning and human approvals.

📚 **Knowledge Extraction** — When you close a workflow, Autarch extracts durable knowledge items with provenance. Ask "How did we handle rate limiting?" years later and get real answers.

🛡️ **Safe by Design** — Explicit approvals for shell commands and sensitive operations. Content gating prevents secrets from leaking to AI models. Shadow workspaces isolate execution — your working directory is never disrupted. See [How It Works](docs/HOW_IT_WORKS.md) for details.

💬 **Two Channel Types** — *Workflow channels* follow the full lifecycle from draft to merged code. *Discussion channels* are think-spaces for research and decisions without code changes. Both extract knowledge on close.

## The Core Loop

1. **Create a Workflow** — Start a new channel for a feature, fix, or exploration
2. **Research & Plan** — Gather context and create a concrete plan (no code changes yet)
3. **Pulse** — Execute bounded work with checkpoint commits; approve sensitive actions
4. **Review** — Generate a Review Card with diffs, reasoning, and evidence
5. **Merge** — Pulse-preserving merge keeps full history for future traceability
6. **Close** — Extract knowledge items to capture decisions and patterns

For the full lifecycle walkthrough, including approval gates, rewind mechanics, and the quick-path variant, see [How It Works](docs/HOW_IT_WORKS.md).

## Getting Started

Autarch is local-first — your code stays on your machine, you use your own API keys, and there's no cloud dependency.

```bash
# Download the binary and point it at your project
autarch /path/to/your/project
```

The onboarding wizard walks you through API key setup and model configuration. From there, create your first workflow and watch it go.

👉 **[Full setup guide →](GETTING_STARTED.md)**

## Architecture

Autarch runs entirely on your machine with a **local-first, cloud-ready** design. An event-sourced architecture enables future team sync, portable Git trailers preserve traceability across clones, and Review Cards export cleanly for collaboration without lock-in.

For the full system design — including the agent pipeline, database architecture, and frontend structure — see [Architecture](ARCHITECTURE.md).

## Project Status

Autarch is in active development. The current focus is validating the core loop:

> Workflow channel → Research/Plan → Checkpointed pulses → Review Card → Pulse-preserving merge → Knowledge extraction

## Documentation

- **[Getting Started](GETTING_STARTED.md)** — Installation, setup, and your first workflow
- **[How It Works](docs/HOW_IT_WORKS.md)** — Full workflow lifecycle, approval gates, and knowledge extraction
- **[Product Thinking](docs/PRODUCT.md)** — Target persona, core loop, knowledge model, and product invariants
- **[Architecture](ARCHITECTURE.md)** — System design, data model, and technical deep-dive
