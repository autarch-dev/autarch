# Autarch

**The Context-First Development OS**

Autarch is a development workflow tool that gives a solo developer the leverage of a 10-person team—and extends that leverage to teams by making reasoning and work-in-flight legible and durable.

## The Problem

Modern AI coding assistants are powerful, but integrating them into real workflows is messy:

- **Lost context**: Conversations disappear, decisions aren't captured, and you're re-explaining things constantly
- **Sync vs. async dilemma**: Either babysit every action or return to find your codebase in an unexpected state
- **Ticket fatigue**: Kanban boards and issue trackers create busywork rather than capturing real intent
- **Tribal knowledge**: Decisions live in Slack threads, DMs, and people's heads—not alongside the code

## The Solution

Autarch replaces tickets with **Workflows**—threaded conversations that map directly to Git branches. Every workflow captures the *why* alongside the *what*, creating a durable record of reasoning that lives with your code forever.

### Key Concepts

**Stream-First Interface**
Instead of a Kanban board, Autarch uses a threaded workspace where each workflow has its own channel. Think Slack, but for building software—with AI that actually understands what you're doing.

**Pulse Execution**
Work happens in bounded "pulses"—checkpointed units of execution that end in a Git commit. You can stop, rewind, or fork at any checkpoint. No more mystery states.

**Review Cards**
When work is ready, generate a Review Card that shows exactly what changed, why it changed, and the reasoning behind each decision. Local PR semantics without requiring a hosted service.

**Team Telepathy**
Every line of code links back to the conversation where it was born. A year from now, `git blame` shows you not just *who* changed something, but *why*—complete with the AI reasoning and human approvals.

**Knowledge Extraction**
When you close a workflow, Autarch extracts durable knowledge items with provenance. Ask "How did we handle rate limiting?" years later and get real answers, not guesses.

## How It Works

### The Core Loop

1. **Create a Workflow** — Start a new channel for a feature, fix, or exploration
2. **Research & Plan** — Gather context and create a concrete plan (no code changes yet)
3. **Pulse** — Execute bounded work with checkpoint commits; approve sensitive actions
4. **Review** — Generate a Review Card with diffs, reasoning, and evidence
5. **Merge** — Pulse-preserving merge keeps full history for future traceability
6. **Close** — Extract knowledge items to capture decisions and patterns

### Safety by Design

Autarch treats trust boundaries as first-class concerns:

- **Explicit approvals** for shell commands, network access, and sensitive operations
- **Content gating** prevents logs, secrets, and sensitive files from leaking to AI models
- **Shadow workspaces** isolate execution—your working directory is never disrupted
- **Git-native durability** means crashes preserve work and you can rewind to any checkpoint

### Channel Types

- **Workflow Channels**: Branch-backed channels that follow the full lifecycle from draft to merged code
- **Discussion Channels**: Think-spaces for research and decisions without code changes, with knowledge extraction on close

## Architecture

Autarch is **local-first**:

- Your code stays on your machine
- Use your own API keys for AI providers
- No cloud dependency required
- Full offline capability

With a **cloud-ready design**:

- Event-sourced architecture enables future team sync
- Portable Git trailers preserve traceability across clones
- Review Cards and knowledge export for collaboration without lock-in

## Project Status

Autarch is in active development. The current focus is validating the core loop:

> Workflow channel → Research/Plan → Checkpointed pulses → Review Card → Pulse-preserving merge → Knowledge extraction

See the [Roadmap](docs/ROADMAP.md) for detailed milestones.

## Documentation

- [Vision](docs/VISION.md) — Philosophy and long-term direction
- [MVP](docs/MVP.md) — Detailed v0 scope and acceptance criteria
- [Architecture](docs/ARCHITECTURE.md) — System design and data model
- [Roadmap](docs/ROADMAP.md) — Milestones and sequencing

