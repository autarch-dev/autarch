# Autarch Agent System

This document describes the architecture of Autarch's multi-agent system, including workflows, sessions, and stage transitions.

## Overview

Autarch uses a multi-agent architecture where each workflow stage has a dedicated agent with specific capabilities:

| Stage | Agent Role | Purpose |
|-------|------------|---------|
| Scoping | Scoping Agent | Analyzes user requests, defines scope |
| Research | Research Agent | Explores codebase, gathers context |
| Planning | Planning Agent | Creates implementation plans |
| Execution | Pulsing Agent | Implements code changes |
| Review | Review Agent | Reviews changes, provides feedback |

Additionally, the **Discussion Agent** handles channel conversations (Q&A about the codebase).

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Frontend (React + Zustand)                   │
├─────────────────────────────────────────────────────────────────────┤
│  WebSocket Store                                                     │
│  - Workflows map (reactive state)                                    │
│  - Sessions map (active sessions)                                    │
│  - Streaming buffers (message/thought deltas)                        │
└────────────────────────────┬────────────────────────────────────────┘
                             │ WebSocket events
┌────────────────────────────┴────────────────────────────────────────┐
│                         Backend (Bun)                                │
├─────────────────────────────────────────────────────────────────────┤
│  WorkflowOrchestrator                                                │
│  - Creates workflows                                                 │
│  - Manages stage transitions                                         │
│  - Handles user approval gates                                       │
├─────────────────────────────────────────────────────────────────────┤
│  SessionManager                                                      │
│  - Tracks concurrent sessions                                        │
│  - Supports multiple channels/workflows active simultaneously        │
├─────────────────────────────────────────────────────────────────────┤
│  AgentRunner                                                         │
│  - Executes LLM requests with streaming                              │
│  - Handles tool calls                                                │
│  - Persists turns, messages, tools, thoughts                         │
├─────────────────────────────────────────────────────────────────────┤
│  SQLite Database (project-scoped)                                    │
│  - workflows, scope_cards, plans                                     │
│  - sessions, turns, turn_messages, turn_tools, turn_thoughts         │
└─────────────────────────────────────────────────────────────────────┘
```

## Workflow Lifecycle

### Stage Transitions

Most transitions require **user approval**:

```
Scoping ─[submit_scope]─> (await approval) ─> Research
Research ─[submit_research]─> (await approval) ─> Planning
Planning ─[submit_plan]─> (await approval) ─> Execution
Execution ─[complete_pulse]─> Review (automatic, no approval)
Review ─[complete_review]─> (await approval) ─> Done
```

### Approval Flow

1. Agent calls a stage-completion tool (e.g., `submit_scope`)
2. Orchestrator saves the artifact and sets `awaiting_approval = true`
3. Frontend receives `workflow:approval_needed` event
4. User reviews the artifact in the UI
5. User either:
   - **Approves**: Orchestrator transitions to next stage, spawns new agent
   - **Requests Changes**: Feedback sent to agent, agent revises and resubmits

### Special Case: Execution → Review

The transition from Execution to Review is **automatic** (no approval needed). When the Pulsing agent calls `complete_pulse`, the workflow immediately transitions to the Review stage.

## Data Model

### Hierarchical Message Structure

```
Session
└── Turn (one LLM invocation)
    ├── Messages (text content blocks)
    ├── Tools (tool calls with input/output)
    └── Thoughts (extended thinking/reasoning)
```

### Key Tables

- **workflows**: Workflow state, current stage, approval status
- **scope_cards**: Scoping agent output (in_scope, out_of_scope, constraints)
- **research_cards**: Research agent output (key files, patterns, recommendations)
- **plans**: Planning agent output (approach summary, pulses)
- **sessions**: Agent sessions tied to channels or workflows
- **turns**: Individual LLM invocations within a session
- **turn_messages**: Text content from turns
- **turn_tools**: Tool calls with input/output
- **turn_thoughts**: Extended thinking content

## WebSocket Events

### Workflow Events

| Event | Description |
|-------|-------------|
| `workflow:created` | New workflow started |
| `workflow:approval_needed` | Artifact ready for user review |
| `workflow:stage_changed` | Stage transition occurred |
| `workflow:completed` | Workflow finished |
| `workflow:error` | Workflow encountered an error |

### Session Events

| Event | Description |
|-------|-------------|
| `session:started` | New agent session started |
| `session:completed` | Session finished |
| `session:error` | Session encountered an error |

### Turn Events

| Event | Description |
|-------|-------------|
| `turn:started` | New turn (user or assistant) started |
| `turn:completed` | Turn finished |

### Streaming Events

| Event | Description |
|-------|-------------|
| `turn:message_delta` | Incremental text from LLM |
| `turn:thought_delta` | Incremental thinking from LLM |
| `turn:tool_started` | Tool execution started |
| `turn:tool_completed` | Tool execution finished |

## API Routes

### Workflow Routes

- `POST /api/workflows` - Create a new workflow
- `GET /api/workflows` - List all workflows
- `GET /api/workflows/:id` - Get workflow by ID
- `POST /api/workflows/:id/approve` - Approve pending artifact
- `POST /api/workflows/:id/request-changes` - Request changes to artifact

### Session Routes

- `POST /api/sessions/:id/message` - Send message to session
- `POST /api/channels/:id/session` - Start channel discussion session

## Tool System

Tools are organized by agent role. See `docs/tools.md` for the complete specification.

### Base Tools (all agents)

- `semantic_search` - Search by meaning
- `read_file` - Read file contents
- `list_directory` - List directory contents
- `glob_search` - Find files by pattern
- `grep` - Search file contents
- `take_note` - Store notes for current stage
- `web_code_search` - Search web for code examples

### Pulsing Tools (execution agent)

- `write_file` - Create/overwrite files
- `edit_file` - Exact string replacement
- `multi_edit` - Multiple edits atomically
- `shell` - Execute shell commands

### Review Tools (review agent)

- `get_diff` - Get changes diff
- `get_scope_card` - Get approved scope
- `add_line_comment` - Comment on specific lines
- `add_file_comment` - Comment on file
- `add_review_comment` - General review comment
- `complete_review` - Submit review verdict

### Block Tools (stage completion)

- `submit_scope` - Submit scope card for approval
- `submit_research` - Submit research findings for approval
- `submit_plan` - Submit plan for approval
- `complete_pulse` - Complete execution (auto-transitions)
- `request_extension` - Request more time (yield point)
- `ask_questions` - Ask user for clarification

## Configuration

Agent configurations are defined in `src/backend/agents/registry.ts`:

```typescript
const agentRegistry = {
  discussion: {
    role: "discussion",
    systemPrompt: agentPrompts.discussion,
    tools: DISCUSSION_TOOLS,
    maxTokens: 4096,
    temperature: 0.7,
  },
  // ... other agents
};
```

Model preferences (which LLM to use for each agent) are configured by the user during onboarding and stored in the global settings database.

## Concurrency

The system supports multiple concurrent sessions:

- A user can chat in a channel while a workflow executes
- Multiple workflows can run simultaneously
- Each session has its own `AbortController` for cancellation

The `SessionManager` tracks all active sessions and provides lookups by ID or by context (channel/workflow).

## Error Handling

- **Session errors**: Persisted to DB, `session:error` event broadcast
- **Workflow errors**: `workflow:error` event broadcast, workflow stays in current stage
- **Tool errors**: Captured in `turn_tools` table, tool result includes error

## Future Work

- [ ] LLM provider integration (Anthropic, OpenAI, Google, xAI)
- [ ] Actual tool implementations
- [ ] Git worktree isolation for pulsing agent
- [ ] Sensitivity gating for file access
- [ ] Context compaction for long conversations
- [ ] Message history retrieval on reconnection
