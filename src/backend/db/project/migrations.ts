import type { Kysely } from "kysely";
import type { ProjectDatabase } from "./types";

/**
 * Run all migrations for the project database
 */
export async function migrateProjectDb(
	db: Kysely<ProjectDatabase>,
): Promise<void> {
	await createProjectMetaTable(db);
	await createChannelsTable(db);
	await createWorkflowsTable(db);
	await createScopeCardsTable(db);
	await createResearchCardsTable(db);
	await createPlansTable(db);
	await createSessionsTable(db);
	await createSessionNotesTable(db);
	await createTurnsTable(db);
	await createTurnMessagesTable(db);
	await createTurnToolsTable(db);
	await createTurnThoughtsTable(db);
	await createQuestionsTable(db);
}

// =============================================================================
// Project Meta
// =============================================================================

async function createProjectMetaTable(
	db: Kysely<ProjectDatabase>,
): Promise<void> {
	await db.schema
		.createTable("project_meta")
		.ifNotExists()
		.addColumn("key", "text", (col) => col.primaryKey())
		.addColumn("value", "text", (col) => col.notNull())
		.addColumn("updated_at", "integer", (col) => col.notNull())
		.execute();
}

// =============================================================================
// Channels (Discussions)
// =============================================================================

async function createChannelsTable(db: Kysely<ProjectDatabase>): Promise<void> {
	await db.schema
		.createTable("channels")
		.ifNotExists()
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("name", "text", (col) => col.notNull())
		.addColumn("description", "text")
		.addColumn("created_at", "integer", (col) => col.notNull())
		.addColumn("updated_at", "integer", (col) => col.notNull())
		.execute();

	// Index for listing channels by name
	await db.schema
		.createIndex("idx_channels_name")
		.ifNotExists()
		.on("channels")
		.column("name")
		.execute();
}

// =============================================================================
// Workflows
// =============================================================================

async function createWorkflowsTable(
	db: Kysely<ProjectDatabase>,
): Promise<void> {
	await db.schema
		.createTable("workflows")
		.ifNotExists()
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("title", "text", (col) => col.notNull())
		.addColumn("description", "text")
		.addColumn("status", "text", (col) => col.notNull().defaultTo("backlog"))
		.addColumn("priority", "text", (col) => col.notNull().defaultTo("medium"))
		.addColumn("current_session_id", "text")
		.addColumn("awaiting_approval", "integer", (col) =>
			col.notNull().defaultTo(0),
		)
		.addColumn("pending_artifact_type", "text")
		.addColumn("created_at", "integer", (col) => col.notNull())
		.addColumn("updated_at", "integer", (col) => col.notNull())
		.execute();

	// Index for listing workflows by status
	await db.schema
		.createIndex("idx_workflows_status")
		.ifNotExists()
		.on("workflows")
		.column("status")
		.execute();
}

// =============================================================================
// Scope Cards
// =============================================================================

async function createScopeCardsTable(
	db: Kysely<ProjectDatabase>,
): Promise<void> {
	await db.schema
		.createTable("scope_cards")
		.ifNotExists()
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("workflow_id", "text", (col) =>
			col.notNull().references("workflows.id"),
		)
		.addColumn("title", "text", (col) => col.notNull())
		.addColumn("description", "text", (col) => col.notNull())
		.addColumn("in_scope_json", "text", (col) => col.notNull())
		.addColumn("out_of_scope_json", "text", (col) => col.notNull())
		.addColumn("constraints_json", "text")
		.addColumn("recommended_path", "text", (col) => col.notNull())
		.addColumn("rationale", "text")
		.addColumn("created_at", "integer", (col) => col.notNull())
		.execute();

	await db.schema
		.createIndex("idx_scope_cards_workflow")
		.ifNotExists()
		.on("scope_cards")
		.column("workflow_id")
		.execute();
}

// =============================================================================
// Research Cards
// =============================================================================

async function createResearchCardsTable(
	db: Kysely<ProjectDatabase>,
): Promise<void> {
	await db.schema
		.createTable("research_cards")
		.ifNotExists()
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("workflow_id", "text", (col) =>
			col.notNull().references("workflows.id"),
		)
		.addColumn("summary", "text", (col) => col.notNull())
		.addColumn("key_files_json", "text", (col) => col.notNull())
		.addColumn("patterns_json", "text")
		.addColumn("dependencies_json", "text")
		.addColumn("integration_points_json", "text")
		.addColumn("challenges_json", "text")
		.addColumn("recommendations_json", "text", (col) => col.notNull())
		.addColumn("created_at", "integer", (col) => col.notNull())
		.execute();

	await db.schema
		.createIndex("idx_research_cards_workflow")
		.ifNotExists()
		.on("research_cards")
		.column("workflow_id")
		.execute();
}

// =============================================================================
// Plans
// =============================================================================

async function createPlansTable(db: Kysely<ProjectDatabase>): Promise<void> {
	await db.schema
		.createTable("plans")
		.ifNotExists()
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("workflow_id", "text", (col) =>
			col.notNull().references("workflows.id"),
		)
		.addColumn("approach_summary", "text", (col) => col.notNull())
		.addColumn("pulses_json", "text", (col) => col.notNull())
		.addColumn("created_at", "integer", (col) => col.notNull())
		.execute();

	await db.schema
		.createIndex("idx_plans_workflow")
		.ifNotExists()
		.on("plans")
		.column("workflow_id")
		.execute();
}

// =============================================================================
// Sessions
// =============================================================================

async function createSessionsTable(db: Kysely<ProjectDatabase>): Promise<void> {
	await db.schema
		.createTable("sessions")
		.ifNotExists()
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("context_type", "text", (col) => col.notNull())
		.addColumn("context_id", "text", (col) => col.notNull())
		.addColumn("agent_role", "text", (col) => col.notNull())
		.addColumn("status", "text", (col) => col.notNull().defaultTo("active"))
		.addColumn("created_at", "integer", (col) => col.notNull())
		.addColumn("updated_at", "integer", (col) => col.notNull())
		.execute();

	// Index for finding sessions by context
	await db.schema
		.createIndex("idx_sessions_context")
		.ifNotExists()
		.on("sessions")
		.columns(["context_type", "context_id"])
		.execute();

	// Index for finding active sessions
	await db.schema
		.createIndex("idx_sessions_status")
		.ifNotExists()
		.on("sessions")
		.column("status")
		.execute();
}

// =============================================================================
// Session Notes
// =============================================================================

async function createSessionNotesTable(
	db: Kysely<ProjectDatabase>,
): Promise<void> {
	await db.schema
		.createTable("session_notes")
		.ifNotExists()
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("session_id", "text", (col) =>
			col.notNull().references("sessions.id"),
		)
		.addColumn("context_type", "text", (col) => col.notNull())
		.addColumn("context_id", "text", (col) => col.notNull())
		.addColumn("content", "text", (col) => col.notNull())
		.addColumn("created_at", "integer", (col) => col.notNull())
		.execute();

	// Index for querying notes by session (used for workflows - notes per stage)
	await db.schema
		.createIndex("idx_session_notes_session")
		.ifNotExists()
		.on("session_notes")
		.column("session_id")
		.execute();

	// Index for querying notes by context (used for channels - notes persist across channel)
	await db.schema
		.createIndex("idx_session_notes_context")
		.ifNotExists()
		.on("session_notes")
		.columns(["context_type", "context_id"])
		.execute();
}

// =============================================================================
// Turns
// =============================================================================

async function createTurnsTable(db: Kysely<ProjectDatabase>): Promise<void> {
	await db.schema
		.createTable("turns")
		.ifNotExists()
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("session_id", "text", (col) =>
			col.notNull().references("sessions.id"),
		)
		.addColumn("turn_index", "integer", (col) => col.notNull())
		.addColumn("role", "text", (col) => col.notNull())
		.addColumn("status", "text", (col) => col.notNull().defaultTo("streaming"))
		.addColumn("token_count", "integer")
		.addColumn("created_at", "integer", (col) => col.notNull())
		.addColumn("completed_at", "integer")
		.execute();

	await db.schema
		.createIndex("idx_turns_session")
		.ifNotExists()
		.on("turns")
		.column("session_id")
		.execute();
}

// =============================================================================
// Turn Messages
// =============================================================================

async function createTurnMessagesTable(
	db: Kysely<ProjectDatabase>,
): Promise<void> {
	await db.schema
		.createTable("turn_messages")
		.ifNotExists()
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("turn_id", "text", (col) => col.notNull().references("turns.id"))
		.addColumn("message_index", "integer", (col) => col.notNull())
		.addColumn("content", "text", (col) => col.notNull())
		.addColumn("created_at", "integer", (col) => col.notNull())
		.execute();

	await db.schema
		.createIndex("idx_turn_messages_turn")
		.ifNotExists()
		.on("turn_messages")
		.column("turn_id")
		.execute();
}

// =============================================================================
// Turn Tools
// =============================================================================

async function createTurnToolsTable(
	db: Kysely<ProjectDatabase>,
): Promise<void> {
	await db.schema
		.createTable("turn_tools")
		.ifNotExists()
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("turn_id", "text", (col) => col.notNull().references("turns.id"))
		.addColumn("tool_index", "integer", (col) => col.notNull())
		.addColumn("tool_name", "text", (col) => col.notNull())
		.addColumn("reason", "text")
		.addColumn("input_json", "text", (col) => col.notNull())
		.addColumn("output_json", "text")
		.addColumn("status", "text", (col) => col.notNull().defaultTo("pending"))
		.addColumn("started_at", "integer", (col) => col.notNull())
		.addColumn("completed_at", "integer")
		.execute();

	await db.schema
		.createIndex("idx_turn_tools_turn")
		.ifNotExists()
		.on("turn_tools")
		.column("turn_id")
		.execute();
}

// =============================================================================
// Turn Thoughts
// =============================================================================

async function createTurnThoughtsTable(
	db: Kysely<ProjectDatabase>,
): Promise<void> {
	await db.schema
		.createTable("turn_thoughts")
		.ifNotExists()
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("turn_id", "text", (col) => col.notNull().references("turns.id"))
		.addColumn("thought_index", "integer", (col) => col.notNull())
		.addColumn("content", "text", (col) => col.notNull())
		.addColumn("created_at", "integer", (col) => col.notNull())
		.execute();

	await db.schema
		.createIndex("idx_turn_thoughts_turn")
		.ifNotExists()
		.on("turn_thoughts")
		.column("turn_id")
		.execute();
}

// =============================================================================
// Questions
// =============================================================================

async function createQuestionsTable(
	db: Kysely<ProjectDatabase>,
): Promise<void> {
	await db.schema
		.createTable("questions")
		.ifNotExists()
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("session_id", "text", (col) =>
			col.notNull().references("sessions.id"),
		)
		.addColumn("turn_id", "text", (col) => col.notNull().references("turns.id"))
		.addColumn("question_index", "integer", (col) => col.notNull())
		.addColumn("type", "text", (col) => col.notNull())
		.addColumn("prompt", "text", (col) => col.notNull())
		.addColumn("options_json", "text")
		.addColumn("answer_json", "text")
		.addColumn("status", "text", (col) => col.notNull().defaultTo("pending"))
		.addColumn("created_at", "integer", (col) => col.notNull())
		.addColumn("answered_at", "integer")
		.execute();

	// Index for querying questions by turn
	await db.schema
		.createIndex("idx_questions_turn")
		.ifNotExists()
		.on("questions")
		.column("turn_id")
		.execute();

	// Index for querying questions by session
	await db.schema
		.createIndex("idx_questions_session")
		.ifNotExists()
		.on("questions")
		.column("session_id")
		.execute();

	// Index for finding pending questions
	await db.schema
		.createIndex("idx_questions_status")
		.ifNotExists()
		.on("questions")
		.column("status")
		.execute();
}
