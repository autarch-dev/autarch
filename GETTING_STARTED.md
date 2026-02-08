# Getting Started

Welcome to Autarch! If you're reading this, you're one of the first people to take it for a spin — and we're glad you're here. Autarch is a local-first AI development tool that runs in your browser and gives you the leverage of a full development team. This guide will walk you through getting it up and running against your own project.

## Prerequisites

- **git** — Your target project must be a git repository. Autarch validates this on startup and will show an error if the directory isn't a git repo (or doesn't have a git root in a parent directory).
- **Bun** — Only required if you're building from source. Install it from [bun.sh](https://bun.sh). If you're using the compiled binary, you don't need Bun at all.

## Installation

### Download the Binary (Recommended)

The fastest way to get started is to download the latest `autarch` binary from the release artifacts. This is a self-contained compiled binary — no runtime dependencies beyond git.

After downloading, make the binary executable and optionally move it somewhere on your PATH:

```bash
chmod +x autarch
mv autarch /usr/local/bin/  # optional, so you can run it from anywhere
```

### Build from Source

If you prefer to build from source, clone the repository and install dependencies:

```bash
git clone https://github.com/autarch-dev/autarch.git
cd autarch
bun install
```

This requires Bun from the Prerequisites section above. If you're interested in contributing, see [CONTRIBUTING.md](CONTRIBUTING.md) for the full contributor setup.

## Running Autarch

How you start Autarch depends on how you installed it.

**Compiled binary:**

Point Autarch at your project directory:

```bash
autarch /path/to/your/project
```

Or, if you're already inside a git repository, just run:

```bash
autarch
```

**From source:**

```bash
bun dev /path/to/your/project
```

Or from within a git repo:

```bash
bun dev
```

On startup, Autarch picks a random available port and automatically opens the app in your default browser. If the browser doesn't open automatically, press `[o]` in the terminal to open it. Press `Ctrl+C` to exit.

The target directory must be a git repository. If it isn't, Autarch will show an error message.

## Setting Up (The Onboarding Wizard)

On first launch, Autarch presents a short onboarding wizard with 5 steps, shown as progress dots at the top of the screen. Just follow the in-app prompts — the wizard is designed to get you configured quickly.

Here's what to expect at each step:

1. **Welcome** — A brief introduction to what Autarch does and how it works.
2. **Features** — An overview of key capabilities.
3. **API Keys** — This is the critical step. You'll need to enter at least one API key from a supported provider: **OpenAI**, **Anthropic**, **Google (Gemini)**, or **xAI (Grok)**. At least one key is required to continue. Your keys are stored locally and never exposed to the frontend.
4. **Model Preferences** — Autarch auto-selects recommended model defaults based on the providers you've configured. You can customize which model handles different tasks, but the defaults work well out of the box.
5. **Complete** — You're all set! The wizard navigates you to the dashboard.

The wizard is the primary setup path — this guide complements it, it doesn't replace it.

## Creating Your First Workflow

Now for the fun part. Here's how to take a task from description to merged code.

**Starting a workflow:** Click the `+` button next to "Workflows" in the sidebar. Enter a description of what you want to build — be as specific as you can about what you're trying to accomplish. Click Create.

**What happens next:** Autarch's AI agents take your description through a structured pipeline. At each stage, you'll review an artifact and approve it to move forward (or provide feedback to refine it). This keeps you in control throughout the process.

- **Scoping** — An AI agent analyzes your request and produces a scope card defining what's in scope, what's out of scope, and any constraints. The agent may recommend a "quick" path for simpler changes that skips some stages. Review the scope card and approve it to continue.
- **Researching** — The agent explores the codebase to understand relevant files, patterns, and integration points, producing a research card. Review and approve to continue.
- **Planning** — Based on scope and research, the agent creates a detailed implementation plan broken into discrete pulses (small, bounded units of work). Review and approve the plan.
- **In Progress** — The agent executes the plan pulse by pulse, making actual code changes to your project. This stage transitions automatically to review when complete.
- **Review** — An AI reviewer examines the changes and provides a review card with comments and a recommendation. Approve to merge the changes and complete the workflow.
- **Done** — The workflow is complete and changes have been merged.

## What to Expect

Autarch is in active development. The current focus is validating the core loop — taking a natural language description through the full scoping, research, planning, execution, and review pipeline.

Things may be rough around the edges. That's expected at this stage, and your experience using it now is genuinely valuable in shaping what Autarch becomes.

A few tips as you get started:

- Start with small, well-defined tasks to get a feel for the workflow before tackling larger changes.
- See [README.md](README.md) for deeper information about Autarch's architecture and concepts.
- See [CONTRIBUTING.md](CONTRIBUTING.md) if you're interested in contributing.

Thanks for being an early adopter. We're building Autarch for people like you, and we're excited to see what you build with it.
