# Security

Autarch is a local-first developer tool that orchestrates AI agents to execute code changes. Because these agents can read files, write code, and run shell commands, security boundaries are a first-class concern. This document describes the security mechanisms currently implemented in Autarch.

## Trust Model

Autarch is designed to run on a developer's local machine and trusts the local user. There is no authentication system, no user sessions, and no per-request authorization. All API endpoints are accessible to any process that can reach the server.

This is a deliberate design choice: Autarch operates as a personal developer tool, not a multi-tenant service. The security mechanisms described below protect the user *from the AI agents*, not from other users.

## API Key Storage and Transmission

API keys for LLM providers (Anthropic, OpenAI, Google, xAI) and the Exa search API are stored locally in a SQLite database as plaintext strings. Keys are never returned through API endpoints — the status endpoint returns only boolean values indicating whether each provider has a key configured (e.g., `{ "openai": true, "anthropic": false }`).

Keys are transmitted only to their respective provider SDKs when making LLM or search API calls. They are not logged, included in agent prompts, or exposed through any other channel.

## Shell Command Approval

Every shell command executed by an AI agent requires human approval before it runs. The approval system uses a blocking Promise pattern: the agent's execution pauses until the user explicitly approves or denies the command through the UI, with real-time notification delivered via WebSocket.

To reduce friction for repeated commands, approvals support two tiers of auto-approval:

- **Project-level persistent approvals** — Commands the user has approved with "always allow for this project" are stored in the project database and auto-approved across all workflows.
- **Workflow-scoped remembered commands** — Commands approved with "remember for this workflow" are held in memory and auto-approved for the duration of that workflow.

Denied commands return an error to the agent, which must find an alternative approach.

## Sensitive File Gating

Agents are blocked from reading files that commonly contain secrets or credentials. A pattern list matches against file paths and basenames, covering:

- Environment files (`.env`, `.env.local`, `.env.production`, etc.)
- Credential and secret files (paths containing `credentials` or `secret`)
- Private keys and certificates (`.pem`, `.key`, `.p12`, `.pfx`)
- SSH keys (`id_rsa`, `id_ed25519`, `id_ecdsa`, `id_dsa`)
- Git credential config (`.git/config`)
- Cloud provider credentials (AWS credentials/config, gcloud credentials)
- Token and auth files (`.npmrc`, `.netrc`, `.htpasswd`)
- Shell history files (`.bash_history`, `.zsh_history`)

When a tool attempts to access a matching file, the operation is blocked and returns a structured error indicating the content is sensitive.

## Git Worktree Isolation

Each workflow executes in its own git worktree on a dedicated branch. Worktrees are created under the `.autarch/worktrees/` directory within the project, with each workflow receiving its own subdirectory and branch. This ensures that agent-driven code changes are isolated from the developer's working directory — agents cannot modify files in the main checkout.

When a workflow completes, its worktree and branch are cleaned up automatically.

## Path Traversal Protection

All file operations validate that paths resolve within the project or worktree root. Paths are normalized and resolved to absolute paths, then checked to confirm they remain within the allowed root directory. The check uses a trailing-separator comparison to prevent prefix-matching bypasses (e.g., a project at `/project` cannot be escaped by referencing `/project-other`).

For read operations, paths that would escape the root return `null`, preventing access. For write operations (file creation, editing), absolute paths are rejected outright and paths that normalize to a parent directory traversal are blocked with an explicit error.

## Agent Role-Based Tool Sandboxing

Autarch defines nine agent roles: basic, discussion, scoping, research, planning, preflight, execution, review, and roadmap planning. Each role has a fixed set of allowed tools defined in the agent registry, and agents cannot use tools outside their assigned set.

For example, read-only agents (discussion, scoping, research) have access to search and file-reading tools but cannot write files or execute shell commands. Only the execution agent has access to code modification tools (`write_file`, `edit_file`, `multi_edit`, `shell`). The preflight agent has shell access for environment setup but cannot modify project files through the editing tools.

This separation ensures that an agent operating in an advisory capacity (research, planning) cannot accidentally or intentionally modify the codebase.

## Reporting a Vulnerability

If you discover a security vulnerability in Autarch, please report it by opening a GitHub issue. As a local-first tool with no cloud infrastructure, Autarch does not operate a bug bounty program or security response team. All reports are appreciated and will be addressed in the normal development process.
