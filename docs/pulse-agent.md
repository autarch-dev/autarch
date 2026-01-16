# Pulsing Agent Phase — Functional Specification

## What This Document Covers

This spec describes the **Pulsing phase** of Autarch's workflow system—the stage where the AI agent actually writes code. It covers:

- The pulsing execution model
- Preflight environment setup
- Agent behavior and completion protocols
- Error handling and recovery

---

## Overview

When a user approves a Plan, Autarch transitions into the **Pulsing phase**. This is where code gets written.

A **pulse** is a discrete, focused unit of work—like a single commit's worth of changes. The system executes pulses sequentially in an isolated git worktree, merging completed work into a workflow branch as it goes.

```
Plan Approved
     │
     ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PULSING PHASE                                │
│                                                                 │
│   ┌──────────┐    ┌──────────┐    ┌──────────┐                │
│   │ Preflight │ →  │ Pulse 1  │ →  │ Pulse 2  │ → ... → Review │
│   │  Setup   │    │          │    │          │                │
│   └──────────┘    └──────────┘    └──────────┘                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Why Pulses?

**Bounded risk.** Each pulse produces a checkpoint commit. If something goes wrong, we can recover to the last good state.

**Focused context.** LLMs perform better with clear, bounded tasks. A pulse says "do this one thing" rather than "implement everything."

**Progress visibility.** Users see incremental progress. Each completed pulse is visible proof of forward motion.

**Clean history.** Each pulse becomes a clean commit. The final PR has a readable, logical commit sequence.

---

## Preflight Setup

Before any pulses run, the system must prepare the development environment. This happens once per workflow, in a phase called **Preflight**.

### What Preflight Does

1. **Initialize dependencies** — `npm install`, `dotnet restore`, `pip install`, etc.
2. **Initialize submodules** — `git submodule update --init --recursive`
3. **Run a baseline build** — Identify any pre-existing errors or warnings
4. **Record baseline issues** — Store known problems so pulses don't get blamed for them

### Why Preflight Matters

Without preflight:
- Pre-existing build errors would cause false failures
- Each pulse would have to deal with environment setup

With preflight:
- Dependencies are installed once before pulses begin
- Known issues are filtered from pulse validation
- Pulses start immediately with a working environment

### Preflight Agent Behavior

The preflight agent has limited tools:
- `shell` — Run setup commands
- `record_baseline` — Log pre-existing errors/warnings

**Critical constraint:** Preflight must NOT modify tracked files. It can only create untracked artifacts (node_modules, bin/, obj/, etc.).

### Preflight Completion

The agent signals completion with a tool call, `preflight_done`:

```json
{
  "summary": "Initialized .NET project with dotnet restore and build",
  "setupCommands": ["dotnet restore", "dotnet build"],
  "buildSuccess": true,
  "baselinesRecorded": 2
}
```

If preflight fails, the entire workflow is abandoned. There's no point running pulses if the environment isn't working.

---

## Worktree Setup

When transitioning to Pulsing:

1. **Create workflow branch** — Branch off the user's base branch (e.g., `main`)
2. **Create worktree** — Create a git worktree for the workflow branch
3. **Run preflight** — Set up environment in the worktree
4. **Execute pulses** — All pulses run sequentially in this worktree

The worktree provides isolation—the agent's changes don't affect the user's working directory.

---

## Pulse Execution

### Pulse Lifecycle

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Proposed   │ ──► │   Running   │ ──► │  Succeeded  │
│             │     │             │     │   Failed    │
│             │     │             │     │   Stopped   │
└─────────────┘     └─────────────┘     └─────────────┘
```

**Proposed** — Created from Plan, waiting to execute  
**Running** — Agent is actively working  
**Succeeded** — Completed with checkpoint commit  
**Failed** — Something went wrong (may have recovery checkpoint)  
**Stopped** — User cancelled (may have recovery checkpoint)

### What Happens When a Pulse Starts

1. **Create pulse branch** — Branch off the workflow branch (e.g., `autarch/workflow-xyz/pulse-abc`)
2. **Create embedding scope** — Index the worktree for semantic search (async, in background)
3. **Send kickoff message** — Provide context to the agent (scope summary, plan context, etc.)
4. **Run agent loop** — Agent reads, writes, edits, runs commands

### Agent Tools (Pulsing)

The pulsing agent has full read/write access:

| Tool | Purpose |
|------|---------|
| `semantic_search` | Find relevant code by meaning |
| `read_file` | Read file contents (required before editing) |
| `list_directory` | Explore directory structure |
| `glob_search` | Find files by pattern |
| `grep` | Regex search in file contents |
| `write_file` | Create or overwrite files |
| `edit_file` | Exact string replacement (single edit) |
| `multi_edit` | Multiple exact string replacements (atomic) |
| `shell` | Run commands (build, test, lint) |

### Edit Tool Rules

Edits use **exact string matching**, not fuzzy matching:

1. Agent must `read_file` before editing
2. `oldString` must match file content exactly (including whitespace)
3. If `oldString` isn't found or matches multiple times (without `replaceAll`), the edit fails
4. Failed edits are **hard failures** — no retries with fuzzy matching

This prevents the agent from accidentally modifying the wrong code.

---

## Completion Protocol

### Successful Completion

When the agent finishes its work, it must call the `pulse_done` tool:

```json
{
  "summary": "feat(auth): implement JWT token validation",
  "filesChanged": ["src/auth/jwt.ts", "src/auth/middleware.ts"]
}
```

**The summary becomes the commit message.** Use Conventional Commits format:
- `feat:` — New feature
- `fix:` — Bug fix
- `refactor:` — Code restructuring
- `docs:`, `test:`, `chore:`, etc.

### Completion Validation

Before accepting completion, the system checks for tool failures in recent messages:

1. **Scan messages** — Look for failed tool calls (non-zero exit codes, errors)
2. **If failures exist** — Reject completion, tell agent to fix issues
3. **If agent tries again and still fails** — Reveal the "escape hatch"

### The Escape Hatch

Sometimes issues genuinely can't be fixed (flaky tests, environment problems). After repeated rejections, the system reveals an option:

```json
{
  "summary": "feat(auth): implement JWT validation",
  "filesChanged": ["src/auth/jwt.ts"],
  "unresolvedIssues": [
    {
      "issue": "Test auth.test.ts times out intermittently",
      "reason": "Appears to be a pre-existing flaky test, not caused by changes"
    }
  ]
}
```

**Warning:** Using `unresolvedIssues` halts automatic orchestration. The next pulse won't start automatically—a human must review first.

### Extension Protocol

If the agent can't finish in one turn (common for complex pulses), it must invoke the `request_extension` tool and yield to the user:

```json
{
  "reason": "Need to implement remaining middleware functions",
  "completed": ["Created jwt.ts with token validation", "Added types"],
  "remaining": ["Implement middleware integration", "Add tests"]
}
```

Extensions are normal. The system will prompt the user and continue execution. Agents should extend early rather than risk truncation.

---

## Baseline Issue Filtering

During preflight, known issues are recorded as **baselines**. When a pulse runs a build and sees errors, it checks:

- Is this error in the baseline? → **Ignore it**
- Is this a new error? → **Report it**

This prevents pulses from failing due to pre-existing technical debt.

### Baseline Structure

```json
{
  "issueType": "Error",        // or "Warning"
  "source": "Build",           // or "Lint", "Test"
  "pattern": "CS0618",         // Error code or message pattern
  "filePath": "src/Legacy.cs", // Optional: specific file
  "description": "Obsolete API" // Optional: context
}
```

---

## Git Integration

### Branch Structure

```
main
 │
 └── autarch/workflow-abc123          (workflow branch -- user specifies the name)
      │
      ├── autarch/workflow-abc123/pulse-xyz001  (pulse 1, merged)
      ├── autarch/workflow-abc123/pulse-xyz002  (pulse 2, merged)
      └── autarch/workflow-abc123/pulse-xyz003  (pulse 3, in progress)
```

### Commit Flow

1. **Pulse works in worktree** — All edits happen in the isolated worktree
2. **Checkpoint commit** — When pulse completes, commit changes with agent's summary
3. **Merge to workflow branch** — Fast-forward merge pulse branch into workflow branch
4. **Delete pulse branch** — Clean up; the commit is now on workflow branch
5. **Reset worktree** — Point worktree at new workflow branch HEAD for next pulse

### Recovery Checkpoints

If a pulse fails or is stopped with uncommitted changes:

1. Create a **recovery checkpoint** commit (marked as such)
2. Keep the pulse branch (for debugging)
3. Mark `isRecoveryCheckpoint: true` on the pulse

This preserves work-in-progress that might be salvageable.

---

## Orchestration

### Sequential Execution

The **Pulse Orchestrator** manages the queue:

1. Plan approved → Start first `Proposed` pulse
2. Pulse completes → Check for more `Proposed` pulses
3. If more exist → Start next pulse
4. If none remain → Transition workflow to Review

### Halting Conditions

Orchestration stops if:

- **Pulse fails** — Needs human intervention
- **Pulse succeeds with `unresolvedIssues`** — Needs human review
- **User stops the workflow** — Manual intervention
- **All pulses complete** — Success! Move to Review

### Message Events

| Event | What Happens |
|-------|--------------|
| `PlanCardResolved` (approved) | Start first pulse |
| `PulseCompleted` (no issues) | Start next pulse |
| `PulseCompleted` (has issues) | Halt for review |
| `ExtensionApproved` | Continue current pulse |

---

## Agent Behavior Guidelines

The pulsing agent operates under strict guidelines:

### DO

- ✅ Make only the changes required for this pulse
- ✅ Read files before editing them
- ✅ Match existing code patterns and conventions
- ✅ Request extension early if running long
- ✅ Use clear, imperative commit messages

### DON'T

- ❌ Expand scope beyond what the pulse specifies
- ❌ Leave TODOs or placeholders
- ❌ Refactor unrelated code
- ❌ Paste code blocks in explanations (reference by file:line)
- ❌ Guess at file contents without reading

### Quality Bar

> **A pulse is a promise.**
>
> If it's marked done, the code must be:
> - Correct
> - Complete  
> - Boring to review
>
> If you wouldn't confidently merge it yourself, it isn't done.

---

## Example Data Model Summary

### Pulse

```typescript
interface Pulse {
  id: string;                    // Unique identifier
  workflowId: string;            // Parent workflow
  plannedPulseId?: string;       // Reference to plan (if from Plan)
  status: PulseStatus;           // Proposed → Running → Terminal
  initiatingMessageId: string;   // Kickoff message
  checkpointCommitSha?: string;  // Commit when done
  diffArtifactId?: string;       // Stored diff for review
  description?: string;          // Summary (becomes commit message)
  pulseBranch?: string;          // e.g., "autarch/workflow-x/pulse-y"
  worktreePath?: string;         // Path to worktree
  hasUnresolvedIssues: boolean;  // If true, halts orchestration
  isRecoveryCheckpoint: boolean; // True if from failure/stop
  createdAt: Date;
  startedAt?: Date;
  endedAt?: Date;
  failureReason?: string;
}

type PulseStatus = "Proposed" | "Running" | "Succeeded" | "Failed" | "Stopped";
```

### PreflightSetup

```typescript
interface PreflightSetup {
  id: string;
  workflowId: string;
  channelId: string;
  status: PreflightStatus;
  progressMessage?: string;
  errorMessage?: string;
  createdAt: Date;
  completedAt?: Date;
}

type PreflightStatus = "Running" | "Completed" | "Failed";
```

### PreflightBaseline

```typescript
interface PreflightBaseline {
  id: string;
  workflowId: string;
  issueType: "Error" | "Warning";
  source: "Build" | "Lint" | "Test";
  pattern: string;               // Error code or message
  filePath?: string;
  description?: string;
  recordedAt: Date;
}
```

---

## Implementation Notes

### Key Behaviors to Preserve

1. **Exact string matching for edits** — Don't implement fuzzy matching; it causes subtle bugs
2. **Message isolation per pulse** — Each pulse only sees its own messages, not other pulses
3. **Progressive rejection** — Don't reveal the escape hatch immediately; push agent to fix issues first
4. **Worktree reset between pulses** — Reset to workflow branch HEAD before starting next pulse
5. **Baseline filtering** — Build errors matching baselines shouldn't fail pulses

### Edge Cases

- **Empty pulse** — Agent completes without changing anything (valid, creates empty commit)
- **Pulse exceeds iteration limit** — Force-complete with failure
- **Preflight timeout** — Fail workflow, clean up worktree

---

## Related Documents

- **TOOLS.md** — Detailed tool specifications
- **DECISIONS.md** — Architectural decisions
