# Autarch Agent Tools

This document describes all tools available to Autarch agents. It serves as the specification for implementing tools and ensuring consistency in tool descriptions passed to the LLM.

## Tool Availability by Agent

| Agent | Tools Available |
|-------|-----------------|
| Discussion | Base tools (read-only) |
| Scoping | Base tools (read-only) |
| Research | Base tools (with file access tracking) |
| Plan | Base tools (read-only) |
| Preflight | Base tools + `shell` + `record_baseline` |
| Pulsing | Base tools + `write_file` + `edit_file` + `multi_edit` + `shell` |
| Review | Base tools + `get_diff` + `get_scope_card` + comment tools + `complete_review` |

---

## Common Parameter: `reason`

All tools require a `reason` parameter for traceability.

**LLM Description:**
```
Required. A short, human-readable statement of the logical purpose of this tool call (e.g. "Add Channels property to ViewModel used by ChannelListView").
Do not describe the tool operation itself (e.g. "edit_file Foo.cs").
Assume this reason may be the only surviving record of the action after a yield.
```

| Property | Value |
|----------|-------|
| Type | `string` |
| Required | Yes |

---

## Base Tools

These read-only tools are available to all agents.

### `semantic_search`

**LLM Description:**
```
Search the codebase for files and code relevant to a query.
Returns ranked results with file paths, line numbers, and matched content snippets.

patternWeights adjusts result ranking by file path:
- Values >1 boost matches (e.g., 2.0 doubles score)
- Values <1 penalize matches (e.g., 0.1 reduces by 90%)
- Value 0 excludes matches entirely
- Use [] for no weighting

Common patterns: boost test files for test questions, deprioritize docs for code questions.
```

**Parameters:**

| Name | Type | Required | Default | LLM Description |
|------|------|----------|---------|-----------------|
| `reason` | `string` | Yes | — | *(see common parameter)* |
| `query` | `string` | Yes | — | `The natural language search query` |
| `patternWeights` | `string[]` | No | `null` | `Pattern weights as 'glob:weight' strings, e.g. ['**/*.cs:1.5', 'docs/**:0.1']. Weight >1 boosts, <1 penalizes, 0 excludes.` |
| `maxResults` | `number` | No | `10` | `Maximum number of results to return (default: 10)` |

**Returns:** JSON array of search results:

```json
[
  {
    "file_path": "src/Example.ts",
    "start_line": 10,
    "end_line": 25,
    "snippet": "...",
    "score": 0.89,
    "adjusted_score": 1.335
  }
]
```

**Error responses:**
- `{ "error": "Project has not been indexed yet." }`

---

### `read_file`

**LLM Description:**
```
Read the contents of a file from the repository.
Can optionally specify a line range to read only a portion of the file.
Some files may be blocked due to sensitive content policies.
```

**Parameters:**

| Name | Type | Required | Default | LLM Description |
|------|------|----------|---------|-----------------|
| `reason` | `string` | Yes | — | *(see common parameter)* |
| `path` | `string` | Yes | — | `Path to file, relative to project root` |
| `startLine` | `number` | No | `null` | `Optional start line (1-indexed, inclusive)` |
| `endLine` | `number` | No | `null` | `Optional end line (1-indexed, inclusive)` |

**Returns:** 
- File contents as plain text string
- Or JSON error: `{ "error": "File not found: <path>" }`
- Or JSON blocked: `{ "blocked": true, "reason": "..." }`

---

### `list_directory`

**LLM Description:**
```
List files and directories at a given path.
Respects .gitignore and .autarchignore rules.
Returns entries with their type (file or directory) and relative path.

- depth controls how deep to traverse (1 = immediate children, 2 = children + grandchildren, null = unlimited)
- type filters results: 'files' (only files), 'directories' (only dirs), 'all' (both)
```

**Parameters:**

| Name | Type | Required | Default | LLM Description |
|------|------|----------|---------|-----------------|
| `reason` | `string` | Yes | — | *(see common parameter)* |
| `path` | `string` | No | `"."` | `Path relative to project root (empty or '.' for root)` |
| `depth` | `number` | No | `1` | `Maximum depth to traverse (1 = immediate children, null = unlimited)` |
| `type` | `string` | No | `"all"` | `Type of entries: 'files', 'directories', or 'all'` |

**Returns:** JSON array of directory entries:

```json
[
  { "path": "src/services", "is_directory": true, "depth": 1 },
  { "path": "src/index.ts", "is_directory": false, "depth": 1 }
]
```

**Error responses:**
- `{ "error": "Directory not found: <path>" }`

---

### `glob_search`

**LLM Description:**
```
Find files matching a glob pattern.
Examples: "**/*.cs" for all C# files, "src/**/test_*.py" for Python test files.
Returns a list of matching file paths relative to the project root.
```

**Parameters:**

| Name | Type | Required | Default | LLM Description |
|------|------|----------|---------|-----------------|
| `reason` | `string` | Yes | — | *(see common parameter)* |
| `pattern` | `string` | Yes | — | `Glob pattern to match files, e.g., '**/*.cs' or 'src/**/*.ts'` |

**Returns:** JSON array of matching file paths:

```json
["src/services/UserService.ts", "src/services/AuthService.ts"]
```

---

### `grep`

**LLM Description:**
```
Search file contents for a pattern using regex matching.
Returns file paths and line numbers for matches.

- Case-insensitive by default (set caseSensitive=true for exact case matching)
- Respects .gitignore and .autarchignore rules
- Skips binary files and files larger than 10MB
- Returns up to 50 matches; use skip parameter to paginate through more results
- Results are sorted alphabetically by file path

Use glob parameter to filter files, e.g., "**/*.cs" for C# files only.
```

**Parameters:**

| Name | Type | Required | Default | LLM Description |
|------|------|----------|---------|-----------------|
| `reason` | `string` | Yes | — | *(see common parameter)* |
| `pattern` | `string` | Yes | — | `The search pattern (literal string or regex depending on useRegex parameter)` |
| `glob` | `string` | No | `null` | `Optional glob pattern to filter files, e.g., '**/*.cs' for C# files only` |
| `caseSensitive` | `boolean` | No | `false` | `If true, perform case-sensitive matching; if false (default), match case-insensitively` |
| `skip` | `number` | No | `0` | `Number of matches to skip for pagination (default: 0)` |

**Returns:** JSON object with results:

```json
{
  "results": [
    { "file_path": "src/Example.ts", "line_number": 42 },
    { "file_path": "src/Other.ts", "line_number": 15 }
  ]
}
```

With pagination warning:
```json
{
  "results": [...],
  "warning": "Only showing 50 matches out of 127. Use skip parameter to paginate through more results."
}
```

With invalid regex:
```json
{
  "warning": "Invalid regex pattern: <message>",
  "results": []
}
```

---

### `take_note`

**LLM Description:**
```
Store a note for the current workflow stage.
Notes persist across agent invocations within the same workflow stage,
but are cleared when the workflow transitions to a different state.
Notes are automatically injected into the conversation on every turn.
```

**Parameters:**

| Name | Type | Required | Default | LLM Description |
|------|------|----------|---------|-----------------|
| `reason` | `string` | Yes | — | *(see common parameter)* |
| `note` | `string` | Yes | — | `The note content to store for the current workflow stage` |

**Returns:**

```json
{ "success": true }
```

**Error responses:**
- `{ "success": false, "error": "Notes are only available in workflow channels" }`
- `{ "success": false, "error": "Note content cannot be empty" }`

---

### `web_code_search`

**LLM Description:**
```
Search and get relevant context for any programming task using Exa Code API
Provides the highest quality and freshest context for libraries, SDKs, and APIs
Use this tool for ANY question or task related to programming
Returns comprehensive code examples, documentation, and API references
Optimized for finding specific programming patterns and solutions
```

**Parameters:**

| Name | Type | Required | Default | LLM Description |
|------|------|----------|---------|-----------------|
| `reason` | `string` | Yes | — | *(see common parameter)* |
| `query` | `string` | Yes | — | `A short query describing the code or documentation to search for, e.g. 'authentication patterns in NextJS applications'` |

**Returns:** Text response with code examples and documentation, or:

```json
{ "error": "There was an error searching the web for code: ..." }
```

---

## Pulsing Tools

Available to the Pulsing agent for code implementation. All operations occur in an isolated git worktree.

### `semantic_search` (Pulsing variant)

**LLM Description:**
```
Search the worktree codebase for files and code relevant to a query.
Returns ranked results with file paths, line numbers, and matched content snippets.

Note: You are working in an isolated git worktree. Search results are from your working copy.

patternWeights adjusts result ranking by file path:
- Values >1 boost matches (e.g., 2.0 doubles score)
- Values <1 penalize matches (e.g., 0.1 reduces by 90%)
- Value 0 excludes matches entirely
```

*(Parameters same as base `semantic_search`)*

---

### `read_file` (Pulsing variant)

**LLM Description:**
```
Read the contents of a file from the repository.
Can optionally specify a line range to read only a portion of the file.
Some files may be blocked due to sensitive content policies.
Required before attempting to edit_file.
```

*(Parameters same as base `read_file`)*

---

### `write_file`

**LLM Description:**
```
Write content to a file in the worktree.
Creates the file if it doesn't exist, or overwrites if it does.
Parent directories are created automatically.

Note: You are working in an isolated git worktree. Changes are isolated until pulse completion.
```

**Parameters:**

| Name | Type | Required | Default | LLM Description |
|------|------|----------|---------|-----------------|
| `reason` | `string` | Yes | — | *(see common parameter)* |
| `path` | `string` | Yes | — | `Path to file, relative to worktree root` |
| `content` | `string` | Yes | — | `Content to write to the file` |

**Returns:**

```json
{
  "success": true,
  "path": "src/NewFile.ts",
  "bytes_written": 1234
}
```

**Error responses:**
- `{ "success": false, "error": "..." }`

---

### `edit_file`

**LLM Description:**
```
Apply an **exact string replacement** in files within the worktree.
Supports single-instance replacements (oldString → newString) and multi-instance replacements via replaceAll.

Edits are applied atomically: if any replacement fails (e.g., oldString not found or multiple matches when replaceAll is not set), no changes are applied and the tool reports a hard failure.

Rules:
- You must read the target file with read_file before editing.
- The oldString must match the file content exactly, including indentation, whitespace, and line endings.
- Line number prefixes from read_file output must not be included in oldString or newString.

Failure is final: do not attempt fuzzy matching or retries.
Note: You are working in an isolated git worktree. Changes are isolated until pulse completion.
```

**Parameters:**

| Name | Type | Required | Default | LLM Description |
|------|------|----------|---------|-----------------|
| `reason` | `string` | Yes | — | *(see common parameter)* |
| `path` | `string` | Yes | — | `Path to file, relative to worktree root` |
| `oldString` | `string` | Yes | — | `Exact content to match in the file (must be found as-is, including whitespace and indentation)` |
| `newString` | `string` | Yes | — | `Replacement content for the matched string (must preserve intended indentation and structure)` |
| `replaceAll` | `boolean` | No | `false` | `If true, replaces all occurrences of oldString; otherwise, fails if multiple matches are found` |

**Returns:**

```json
{ "success": true }
```

**Error responses:**
- `{ "error": "File not found: <path>" }`
- `{ "error": "oldString not found" }`
- `{ "error": "oldString found multiple times" }`
- `{ "blocked": true, "reason": "..." }`

---

### `multi_edit`

**LLM Description:**
```
Apply **multiple exact string replacements** to a single file atomically.
More efficient than multiple edit_file calls when making several changes to the same file.

Edits are applied sequentially in array order, each operating on the result of the previous edit.
This allows overlapping or adjacent edits to work correctly.

All edits are validated before any are applied. If any edit fails validation:
- No changes are written to the file
- The tool reports which edit failed and why

Rules:
- You must read the target file with read_file before editing.
- Each oldString must match the file content exactly (at the time that edit is applied).
- Line number prefixes from read_file output must not be included in oldString or newString.
- Each edit has its own replaceAll parameter.

Failure is final: do not attempt fuzzy matching or retries.
Note: You are working in an isolated git worktree. Changes are isolated until pulse completion.
```

**Parameters:**

| Name | Type | Required | Default | LLM Description |
|------|------|----------|---------|-----------------|
| `reason` | `string` | Yes | — | *(see common parameter)* |
| `path` | `string` | Yes | — | `Path to file, relative to worktree root` |
| `edits` | `EditOperation[]` | Yes | — | `Array of edit operations to apply sequentially. Each edit has: oldString (exact content to match), newString (replacement content), replaceAll (optional, if true replaces all occurrences)` |

**EditOperation structure:**

```typescript
interface EditOperation {
  oldString: string;   // Exact content to match
  newString: string;   // Replacement content
  replaceAll?: boolean; // If true, replaces all occurrences (default: false)
}
```

**Returns:**

```json
{
  "success": true,
  "edits_applied": 3
}
```

**Error responses:**
- `{ "error": "File not found: <path>" }`
- `{ "error": "No edits provided" }`
- `{ "error": "Edit 2: oldString not found", "edit_index": 2, "oldString_preview": "..." }`
- `{ "error": "Edit 1: oldString found 3 times (set replaceAll=true to replace all)", "edit_index": 1, "found_count": 3, "oldString_preview": "..." }`
- `{ "error": "Edit 0: oldString is empty", "edit_index": 0 }`
- `{ "blocked": true, "reason": "..." }`

---

### `shell` (Pulsing variant)

**LLM Description:**
```
Execute a shell command in the worktree directory.
Returns stdout, stderr, and exit code.
Commands time out after 60 seconds.

Note: You are working in an isolated git worktree. All commands run in that context.

WARNING: Shell commands can have side effects. Use with caution.
         If you have other tools that can accomplish the same thing, use them instead.
```

**Parameters:**

| Name | Type | Required | Default | LLM Description |
|------|------|----------|---------|-----------------|
| `reason` | `string` | Yes | — | *(see common parameter)* |
| `command` | `string` | Yes | — | `Shell command to execute` |
| `timeoutSeconds` | `number` | No | `60` | `Timeout in seconds (default: 60, max: 300)` |

**Returns:**

```json
{
  "success": true,
  "exit_code": 0,
  "stdout": "...",
  "stderr": "..."
}
```

**Timeout response:**
```json
{
  "success": false,
  "error": "Command timed out after 60 seconds",
  "stdout": "...",
  "stderr": "..."
}
```

**Error responses:**
- `{ "success": false, "error": "..." }`

**Notes:**
- Output is truncated to prevent excessive response sizes
- Sensitive output may be gated and replaced with `[blocked]`

---

## Preflight Tools

Available to the Preflight agent for environment setup. Must not modify tracked files.

### `shell` (Preflight variant)

**LLM Description:**
```
Execute a shell command in the worktree directory.
Returns stdout, stderr, and exit code.
Commands time out after 60 seconds.

Use this to run environment setup commands like:
- git submodule update --init --recursive
- dotnet restore
- npm install
- pip install -r requirements.txt

WARNING: You must NOT modify any files tracked by git.
Only untracked artifacts (dependencies, build outputs) may be created.
```

*(Parameters same as Pulsing `shell`)*

---

### `record_baseline`

**LLM Description:**
```
Record a known build/lint error or warning from the clean worktree state.
Pulses will filter out these known issues from their own build/lint output.

Use this after running build/lint commands to record any pre-existing issues
that are not caused by pulse changes.

Parameters:
- issueType: "Error" or "Warning"
- source: "Build", "Lint", or "Test"
- pattern: The exact error/warning message or a pattern to match
- filePath: Optional file path associated with the issue
- description: Optional description for context
```

**Parameters:**

| Name | Type | Required | Default | LLM Description |
|------|------|----------|---------|-----------------|
| `reason` | `string` | Yes | — | *(see common parameter)* |
| `issueType` | `string` | Yes | — | `Type of issue: 'Error' or 'Warning'` |
| `source` | `string` | Yes | — | `Source of the issue: 'Build', 'Lint', or 'Test'` |
| `pattern` | `string` | Yes | — | `The exact error/warning message or pattern to match` |
| `filePath` | `string` | No | `null` | `Optional file path associated with this issue` |
| `description` | `string` | No | `null` | `Optional description for context` |

**Returns:**

```json
{
  "success": true,
  "baselineId": "abc123",
  "message": "Recorded Warning baseline from Build: CS0618..."
}
```

**Error responses:**
- `{ "success": false, "error": "Invalid issueType 'Info'. Must be 'Error' or 'Warning'." }`
- `{ "success": false, "error": "Invalid source 'Compile'. Must be 'Build', 'Lint', or 'Test'." }`

---

## Review Tools

Available to the Review agent for code review.

### `get_diff`

**LLM Description:**
```
Retrieve the diff content for the current review.
Returns the unified diff showing all changes made during the workflow.
Use this to analyze what was changed before submitting your review summary.
```

**Parameters:**

| Name | Type | Required | Default | LLM Description |
|------|------|----------|---------|-----------------|
| `reason` | `string` | Yes | — | `Required. A short, human-readable statement of the logical purpose of this tool call.` |

**Returns:**

```json
{
  "success": true,
  "diff": "diff --git a/src/Example.ts b/src/Example.ts\n..."
}
```

**Error responses:**
- `{ "error": "Diff artifact not found" }`
- `{ "success": false, "error": "..." }`

---

### `get_scope_card`

**LLM Description:**
```
Retrieve the approved scope card for the current workflow.
Returns the scope definition including in-scope items, out-of-scope items,
and constraints. Use this to verify changes align with the approved scope.
```

**Parameters:**

| Name | Type | Required | Default | LLM Description |
|------|------|----------|---------|-----------------|
| `reason` | `string` | Yes | — | `Required. A short, human-readable statement of the logical purpose of this tool call.` |

**Returns:**

```json
{
  "success": true,
  "title": "Add user authentication",
  "description": "Implement JWT-based authentication",
  "in_scope": ["Login endpoint", "Token refresh"],
  "out_of_scope": ["OAuth integration"],
  "constraints": ["Must use existing user table"]
}
```

**Error responses:**
- `{ "error": "Scope card not found" }`
- `{ "success": false, "error": "..." }`

---

### `add_line_comment`

**LLM Description:**
```
Add a comment attached to specific line(s) in a file.
Use this to provide feedback on specific code changes in the diff.
```

**Parameters:**

| Name | Type | Required | Default | LLM Description |
|------|------|----------|---------|-----------------|
| `reason` | `string` | Yes | — | `Required. A short, human-readable statement of the logical purpose of this tool call.` |
| `file_path` | `string` | Yes | — | `The file path this comment applies to` |
| `start_line` | `number` | Yes | — | `The starting line number for the comment` |
| `severity` | `string` | Yes | — | `The severity level: High, Medium, or Low` |
| `category` | `string` | Yes | — | `The category of the comment (e.g., security, performance, style, bug, architecture)` |
| `description` | `string` | Yes | — | `The description/content of the comment` |
| `end_line` | `number` | No | `null` | `The ending line number (inclusive). Omit for single-line comments.` |

**Returns:**

```json
{
  "success": true,
  "comment_id": "abc123",
  "message": "Line comment added successfully"
}
```

**Error responses:**
- `{ "success": false, "error": "Invalid severity 'Critical'. Must be High, Medium, or Low." }`
- `{ "success": false, "error": "file_path is required for line comments" }`
- `{ "success": false, "error": "start_line must be a positive integer" }`
- `{ "success": false, "error": "end_line must be greater than or equal to start_line" }`
- `{ "success": false, "error": "Review card not found" }`

---

### `add_file_comment`

**LLM Description:**
```
Add a comment attached to a file as a whole.
Use this to provide feedback about a file that isn't tied to specific lines.
```

**Parameters:**

| Name | Type | Required | Default | LLM Description |
|------|------|----------|---------|-----------------|
| `reason` | `string` | Yes | — | `Required. A short, human-readable statement of the logical purpose of this tool call.` |
| `file_path` | `string` | Yes | — | `The file path this comment applies to` |
| `severity` | `string` | Yes | — | `The severity level: High, Medium, or Low` |
| `category` | `string` | Yes | — | `The category of the comment (e.g., security, performance, style, bug, architecture)` |
| `description` | `string` | Yes | — | `The description/content of the comment` |

**Returns:**

```json
{
  "success": true,
  "comment_id": "abc123",
  "message": "File comment added successfully"
}
```

**Error responses:**
- `{ "success": false, "error": "Invalid severity 'Critical'. Must be High, Medium, or Low." }`
- `{ "success": false, "error": "file_path is required for file comments" }`
- `{ "success": false, "error": "Review card not found" }`

---

### `add_review_comment`

**LLM Description:**
```
Add a comment attached to the overall review.
Use this for general observations or feedback not tied to specific files or lines.
```

**Parameters:**

| Name | Type | Required | Default | LLM Description |
|------|------|----------|---------|-----------------|
| `reason` | `string` | Yes | — | `Required. A short, human-readable statement of the logical purpose of this tool call.` |
| `severity` | `string` | Yes | — | `The severity level: High, Medium, or Low` |
| `category` | `string` | Yes | — | `The category of the comment (e.g., security, performance, style, bug, architecture)` |
| `description` | `string` | Yes | — | `The description/content of the comment` |

**Returns:**

```json
{
  "success": true,
  "comment_id": "abc123",
  "message": "Review comment added successfully"
}
```

**Error responses:**
- `{ "success": false, "error": "Invalid severity 'Critical'. Must be High, Medium, or Low." }`
- `{ "success": false, "error": "Review card not found" }`

---

### `complete_review`

**LLM Description:**
```
Complete the review with a recommendation and summary.
Call this tool once after adding all comments to finalize the review.
The recommendation must be one of: approve, reject, or manual_review.
```

**Parameters:**

| Name | Type | Required | Default | LLM Description |
|------|------|----------|---------|-----------------|
| `reason` | `string` | Yes | — | `Required. A short, human-readable statement of the logical purpose of this tool call.` |
| `recommendation` | `string` | Yes | — | `The recommendation: approve, reject, or manual_review` |
| `summary` | `string` | Yes | — | `A summary explanation for the recommendation` |

**Returns:**

```json
{
  "success": true,
  "recommendation": "approve",
  "message": "Review completed successfully"
}
```

**Error responses:**
- `{ "success": false, "error": "Invalid recommendation 'pass'. Must be one of: approve, reject, manual_review." }`
- `{ "success": false, "error": "Summary is required." }`
- `{ "success": false, "error": "Review card not found" }`

---

## Research Tools

The Research agent uses all base tools, with `read_file` enhanced to track file access for research provenance. The LLM description is extended:

### `read_file` (Research variant)

**LLM Description:**
```
Read the contents of a file from the repository.
Can optionally specify a line range to read only a portion of the file.
Some files may be blocked due to sensitive content policies.
File access is tracked for research provenance.
```

*(Parameters same as base `read_file`)*

---

## Scoping and Plan Tools

The Scoping and Plan agents use only the base read-only tools. They emit their outputs (scope cards and plans) as markdown blocks in agent messages rather than through dedicated tools:
- Scope proposals: `:::autarch-scope` markdown blocks
- Plans: `:::autarch-plan` markdown blocks

---

## Sensitivity Gating

All tools that read or output file content interact with a sensitivity gate that:
- Blocks files matching sensitive path patterns (e.g., `.env`, credentials files)
- Filters sensitive content from responses
- Gates shell command output

Blocked content returns:

```json
{ "blocked": true, "reason": "File contains sensitive content" }
```

---

## Implementation Notes

### Error Response Patterns

Tools use consistent JSON error patterns:

```typescript
// Simple error
{ error: string }

// Operation result with error
{ success: false, error: string }

// Content blocked
{ blocked: true, reason: string }
```

### Behavioral Constants

| Constant | Value | Used By |
|----------|-------|---------|
| Max file size for grep | 10 MB | `grep` |
| Max grep results per call | 50 | `grep` |
| Binary detection threshold | 10% control chars | `grep` |
| Shell timeout max | 300 seconds | `shell` |
| Shell timeout default | 60 seconds | `shell` |
| Output truncation threshold | 512 chars | `shell` |

---

## Structured Output Tools (Block-Based)

These tools are currently implemented as `:::autarch-*` markdown blocks in agent messages. When converting to a TypeScript implementation, they should be converted to proper tool calls for consistency and type safety.

### Block Tool Availability by Agent

| Agent | Block Tools Available |
|-------|----------------------|
| Scoping | `submit_scope`, `ask_questions` |
| Research | `submit_research`, `request_extension`, `ask_questions` |
| Plan | `submit_plan` |
| Preflight | `complete_preflight` |
| Pulsing | `complete_pulse`, `request_extension` |
| Review | *(uses `complete_review` tool instead)* |

---

### `submit_scope`

Submits a finalized scope card for user approval. Used by the Scoping agent when all Four Pillars (outcome, boundaries, constraints, success criteria) are clearly defined.

**Current Block Syntax:** `:::autarch-scope`

**LLM Description (from system prompt):**
```
When you're ready to define the scope, emit a single structured block.
The block IS the scope. Anything outside it doesn't count.
After emitting the scope block, stop. No additional content.
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `title` | `string` | Yes | Brief title of what this scope covers |
| `description` | `string` | Yes | A few sentences describing the scope in detail |
| `in_scope` | `string[]` | Yes | List of items explicitly in scope |
| `out_of_scope` | `string[]` | Yes | List of items explicitly out of scope |
| `constraints` | `string[]` | No | List of binding constraints that must not be violated |
| `recommended_path` | `"quick" \| "full"` | Yes | Recommended workflow path |
| `rationale` | `string` | No | Explanation of why the recommended path was chosen |

**Schema:**

```typescript
interface SubmitScopeParams {
  title: string;
  description: string;
  in_scope: string[];
  out_of_scope: string[];
  constraints?: string[];
  recommended_path: "quick" | "full";
  rationale?: string;
}
```

**Path Guidelines:**
- **quick**: Scoping → Pulsing (single auto-executed pulse). For 1-2 files, existing patterns, low risk.
- **full**: Scoping → Research → Plan → Pulsing. For 3+ files, new abstractions, cross-cutting changes.

---

### `submit_research`

Submits completed research findings for user approval. Used by the Research agent when sufficient understanding has been built to guide implementation.

**Current Block Syntax:** `:::autarch-research`

**LLM Description (from system prompt):**
```
When—and only when—you have sufficient understanding to guide implementation, end the message with an autarch-research block.

Before producing it:
- Review accumulated notes
- Ensure all key findings are incorporated
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `summary` | `string` | Yes | Concise, factual overview of how the relevant system works |
| `keyFiles` | `KeyFile[]` | Yes | Important files discovered during research |
| `patterns` | `Pattern[]` | No | Observed patterns used consistently across the codebase |
| `dependencies` | `Dependency[]` | No | External libraries or modules relevant to the work |
| `integrationPoints` | `IntegrationPoint[]` | No | Locations where new behavior should attach |
| `challenges` | `Challenge[]` | No | Technical or architectural risks |
| `recommendations` | `string[]` | Yes | Clear, directive guidance for implementation |

**Schema:**

```typescript
interface SubmitResearchParams {
  summary: string;
  keyFiles: Array<{
    path: string;
    purpose: string;
    lineRanges?: string;  // e.g., "45-120, 200-250"
  }>;
  patterns?: Array<{
    category: string;      // e.g., "error-handling", "dependency-injection"
    description: string;
    example: string;       // Describe in words, not code
    locations: string[];   // e.g., ["file.ts:10-50", "other.ts:100-120"]
  }>;
  dependencies?: Array<{
    name: string;
    purpose: string;
    usageExample: string;
  }>;
  integrationPoints?: Array<{
    location: string;
    description: string;
    existingCode: string;  // Reference to relevant files/lines
  }>;
  challenges?: Array<{
    issue: string;
    mitigation: string;
  }>;
  recommendations: string[];  // No alternatives, no hedging
}
```

---

### `submit_plan`

Submits an execution plan for user approval. Used by the Plan agent after verifying research findings against the codebase.

**Current Block Syntax:** `:::autarch-plan`

**LLM Description (from system prompt):**
```
When the plan is ready, you must end your message with a single :::autarch-plan block.
This block is the execution contract.
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `approachSummary` | `string` | Yes | High-level description of how the solution will be implemented |
| `pulses` | `Pulse[]` | Yes | Ordered list of execution units |

**Schema:**

```typescript
interface SubmitPlanParams {
  approachSummary: string;
  pulses: Array<{
    id: string;              // e.g., "pulse-1", "pulse-2"
    title: string;           // Short, concrete pulse title
    description: string;     // What this pulse accomplishes and why
    expectedChanges: string[]; // File paths expected to be modified
    estimatedSize: "small" | "medium" | "large";
    dependsOn?: string[];    // IDs of pulses that must complete first
  }>;
}
```

**Pulse Size Guidelines:**
- **small**: < 50 lines of change
- **medium**: 50–200 lines
- **large**: > 200 lines (avoid unless unavoidable)

---

### `request_extension`

Requests additional execution time. Used as a yield point to pause execution, allow context compaction, and continue in a subsequent turn.

**Current Block Syntax:** `:::autarch-extend`

**LLM Description (from system prompt):**
```
autarch-extend is a yield.

When you emit autarch-extend, you are:
- Pausing execution
- Yielding control to the user
- Allowing context compaction to occur

You MUST NOT perform additional work after emitting it.
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `reason` | `string` | Yes | Why additional time/exploration is required |
| `completed` | `string[]` | Yes | Concrete work already completed in this turn |
| `remaining` | `string[]` | Yes | Concrete work still required |

**Schema:**

```typescript
interface RequestExtensionParams {
  reason: string;
  completed: string[];
  remaining: string[];
}
```

**Used By:**
- **Research**: After 8 research actions per turn (mandatory yield)
- **Pulsing**: When pulse cannot be completed safely in a single turn
- **Preflight**: When environment setup requires multiple turns

**Extension Rules:**
1. Must be the **last** content in the message
2. Cannot be combined with completion blocks
3. Agent must stop after emitting

---

### `ask_questions`

Asks structured questions requiring user input. Used when the agent cannot proceed without explicit user decisions.

**Current Block Syntax:** `:::autarch-questions`

**LLM Description (from system prompt):**
```
All questions use autarch-questions. Period. No exceptions.

You cannot ask questions in prose, bullets, or inline text.
If you need clarification, emit an autarch-questions block and stop.
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `questions` | `Question[]` | Yes | Array of structured questions |

**Schema:**

```typescript
interface AskQuestionsParams {
  questions: Array<{
    type: "single_select" | "multi_select" | "ranked" | "free_text";
    prompt: string;
    options?: string[];  // Required for single_select, multi_select, ranked
  }>;
}
```

**Question Types:**
- **single_select**: User picks one option
- **multi_select**: User picks multiple options
- **ranked**: User orders options by preference
- **free_text**: User provides freeform text response

**Used By:**
- **Scoping**: For clarifying scope, boundaries, constraints
- **Research**: When user intent affects behavior (rarely)

**Rules:**
1. Questions are a **terminal yield** — no work after asking
2. Must be the **last** content in the message
3. Cannot be combined with other `autarch-*` blocks

---

### `complete_pulse`

Signals pulse completion with a summary suitable for commit message. Used by the Pulsing agent when all requirements are satisfied.

**Current Block Syntax:** `:::autarch-pulse-done`

**LLM Description (from system prompt):**
```
Only when ALL pulse requirements are satisfied—code complete and clean—may you mark the pulse as done.

The summary field becomes the commit message. Format it as a Conventional Commit.
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `summary` | `string` | Yes | Conventional commit message (e.g., "feat(auth): implement login flow") |
| `filesChanged` | `string[]` | Yes | List of file paths that were modified |
| `unresolvedIssues` | `UnresolvedIssue[]` | No | Acknowledged issues that couldn't be fixed (escape hatch) |

**Schema:**

```typescript
interface CompletePulseParams {
  summary: string;  // Conventional commit format: type(scope): description
  filesChanged: string[];
  unresolvedIssues?: Array<{
    issue: string;
    reason: string;
  }>;
}
```

**Commit Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `build`, `ci`

**Completion Rejection:**
The system validates pulse completion by checking for tool failures. If failures exist:
1. First attempt: Completion is rejected, agent must fix issues
2. After threshold: `unresolvedIssues` escape hatch is revealed

**Rules:**
1. Must be the **last** content in the message
2. No additional text, explanations, or caveats
3. Cannot be combined with `request_extension`

---

### `complete_preflight`

Signals preflight environment setup is complete. Used by the Preflight agent after initializing dependencies and recording baselines.

**Current Block Syntax:** `:::autarch-preflight-done`

**LLM Description (from system prompt):**
```
When environment setup is complete, provide a summary of:
1. What setup commands were run
2. Whether the build succeeded
3. How many baseline issues were recorded (if any)
```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `summary` | `string` | Yes | Brief description of setup completed |
| `setupCommands` | `string[]` | Yes | List of commands that were executed |
| `buildSuccess` | `boolean` | Yes | Whether the project builds successfully |
| `baselinesRecorded` | `number` | Yes | Count of baseline issues recorded |

**Schema:**

```typescript
interface CompletePreflightParams {
  summary: string;
  setupCommands: string[];
  buildSuccess: boolean;
  baselinesRecorded: number;
}
```

**Rules:**
1. Must be the **last** content in the message
2. No additional text after the block

---

## Block Tool Behavioral Rules

### Mutual Exclusivity

Only **one** structured output block may appear per message:

| ✅ Valid | ❌ Invalid |
|----------|-----------|
| Message ends with `submit_scope` | Message with both `submit_scope` and `ask_questions` |
| Message ends with `request_extension` | Message with both `complete_pulse` and `request_extension` |
| Message ends with `ask_questions` | Questions asked in prose instead of block |

### Terminal Yield Semantics

When an agent emits any of these blocks, they **must stop**:
- No additional tool calls
- No additional prose
- No additional blocks

The block represents a yield point where control transfers to the user or system.

### Block Position

All structured output blocks must be the **final content** in the agent's message. Content after the block is invalid and may cause parsing failures.
