# Autarch

**The leverage of a small team, for a solo developer.**

Autarch is a local-first AI development tool that replaces tickets and task boards with **Workflows** — threaded conversations tied to Git branches where every decision, line of reasoning, and approval lives right next to the code it produced.

Your code stays on your machine. There is no cloud dependency.

<img width="1861" height="991" alt="Autarch workflow interface" src="https://github.com/user-attachments/assets/4016ddfb-bd92-447c-bd74-fcc3aecf650f" />

## Why Autarch

AI coding assistants are useful, but context disappears between conversations. Reasoning ends up scattered across chat logs and your own memory. You either watch over every action or come back to a codebase you don't recognize.

Autarch brings structure so AI-assisted development is **traceable, reversible, and safe**.

- **Workflows, not tickets.** Each workflow is a conversation thread backed by a Git branch. Describe what you want; agents handle research, planning, execution, and review.
- **Checkpointed work.** Everything happens in bounded "pulses" that end in a Git commit. Stop, rewind, or branch off at any checkpoint.
- **Review cards.** Structured summaries of what changed, why, and the reasoning behind each decision — local PR review without a hosted service.
- **Full traceability.** Every line of code links back to the conversation where it was written. `git blame` shows not just *who*, but *why*.
- **Knowledge that persists.** When you close a workflow, Autarch extracts decisions, patterns, and trade-offs with provenance. Ask "how did we handle rate limiting?" months later and get a real answer.
- **Safe by default.** Shell commands and sensitive operations require explicit approval. Content gating keeps secrets away from AI models. A shadow worktree isolates execution so your working directory is never disrupted.

## How a Workflow Works

```
Scoping → Research → Planning → Execution (pulses) → Review → Done
```

1. **Start a workflow** — open a channel for a feature, bug fix, or exploration.
2. **Scope** — the agent clarifies requirements and boundaries. You choose a quick path (skip straight to a single pulse) or the full path.
3. **Research** — the agent gathers codebase context and produces findings for your review.
4. **Plan** — a concrete implementation plan you approve before any code changes.
5. **Pulse** — a bounded chunk of work ending in a checkpoint commit. Approve any sensitive actions along the way.
6. **Review** — a review card with diffs, reasoning, and evidence. Approve to merge.
7. **Close** — knowledge items are extracted so decisions and patterns are captured for good.

Each workflow runs in an isolated Git worktree on its own branch. Your working directory is never touched.

There are also **Discussion channels** for research and decisions that don't involve code changes. Both channel types capture knowledge on close.

## Roadmaps

Autarch can help you figure out *what to build next*. The Roadmap feature generates a codebase-aware plan by running four AI personas in parallel:

- **The Visionary** — product potential, ambitious ideas, identity
- **The Iterative** — what to ship next, quick wins, user friction
- **The Tech Lead** — tech debt, test gaps, scalability, dependency health
- **The Pathfinder** — leverage plays, convergence points, things the others missed

A synthesis agent reads every proposal, surfaces agreements and conflicts, and works with you to produce a unified roadmap with a vision document, ordered milestones, and sized initiatives. Initiatives link directly to workflows so there's a clean bridge from planning to execution.

## Agent Backends

Autarch supports two ways to run its AI agents:

| Backend | How it works | Setup |
|---------|-------------|-------|
| **API** | Autarch calls LLM providers directly (Anthropic, OpenAI, Google, AWS Bedrock, xAI). Pay per token. | Bring your own API keys |
| **Claude Code** | Delegates to a local [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI. Autarch's tools are exposed via MCP; Claude Code handles file I/O and conversation management natively. | Install and authenticate Claude Code CLI |

Choose the backend during onboarding or switch later in Settings. Both support the full workflow lifecycle.

## Getting Started

### Prerequisites

- **Git** — your target project must be a git repository
- **Bun** — only required if building from source ([bun.sh](https://bun.sh))

### Download the Binary (Recommended)

Download the latest `autarch` binary from the release artifacts. It's self-contained — no runtime dependencies beyond git.

```bash
chmod +x autarch
mv autarch /usr/local/bin/   # optional
autarch /path/to/your/project
```

### Build from Source

```bash
git clone https://github.com/autarch-dev/autarch.git
cd autarch
bun install
bun dev /path/to/your/project
```

The app opens automatically in your browser. The onboarding wizard walks you through backend selection and API key configuration.

**[Full setup guide →](GETTING_STARTED.md)**

## Architecture

Autarch is a local Bun server with a React frontend, backed by SQLite databases and an event-sourced WebSocket architecture. Agents are composed from role-specific tool sets and system prompts, with a 7-stage workflow state machine driving the lifecycle.

For the full system design — agent pipeline, database schema, frontend structure — see [Architecture](ARCHITECTURE.md).

## Project Status

Autarch is in active development, focused on validating the core loop end-to-end:

> Workflow → Research/Plan → Checkpointed pulses → Review Card → Merge → Knowledge extraction

## Documentation

- **[Getting Started](GETTING_STARTED.md)** — Installation, setup, and your first workflow
- **[How It Works](docs/HOW_IT_WORKS.md)** — Workflow lifecycle, approval gates, and knowledge extraction
- **[Product Thinking](docs/PRODUCT.md)** — Target persona, core loop, knowledge model, and product invariants
- **[Architecture](ARCHITECTURE.md)** — System design, data model, and technical deep-dive
- **[Contributing](CONTRIBUTING.md)** — Development setup and conventions
- **[Security](SECURITY.md)** — Security policies

## License

Apache-2.0
