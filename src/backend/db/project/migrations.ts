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
	await createPulsesTable(db);
	await createPreflightSetupTable(db);
	await createPreflightBaselinesTable(db);
	await createSessionsTable(db);
	await createSessionNotesTable(db);
	await createTurnsTable(db);
	await createTurnMessagesTable(db);
	await createTurnToolsTable(db);
	await createTurnThoughtsTable(db);
	await createQuestionsTable(db);
	await addArtifactStatusColumns(db);
	await addVerificationInstructionsColumn(db);
	await addBaseBranchColumn(db);
	await createReviewCardsTable(db);
	await createReviewCommentsTable(db);
	await addArtifactTurnIdColumns(db);
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
// Pulses
// =============================================================================

async function createPulsesTable(db: Kysely<ProjectDatabase>): Promise<void> {
	await db.schema
		.createTable("pulses")
		.ifNotExists()
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("workflow_id", "text", (col) =>
			col.notNull().references("workflows.id"),
		)
		.addColumn("planned_pulse_id", "text")
		.addColumn("status", "text", (col) => col.notNull().defaultTo("proposed"))
		.addColumn("description", "text")
		.addColumn("pulse_branch", "text")
		.addColumn("worktree_path", "text")
		.addColumn("checkpoint_commit_sha", "text")
		.addColumn("diff_artifact_id", "text")
		.addColumn("has_unresolved_issues", "integer", (col) =>
			col.notNull().defaultTo(0),
		)
		.addColumn("is_recovery_checkpoint", "integer", (col) =>
			col.notNull().defaultTo(0),
		)
		.addColumn("rejection_count", "integer", (col) =>
			col.notNull().defaultTo(0),
		)
		.addColumn("created_at", "integer", (col) => col.notNull())
		.addColumn("started_at", "integer")
		.addColumn("ended_at", "integer")
		.addColumn("failure_reason", "text")
		.execute();

	// Index for finding pulses by workflow
	await db.schema
		.createIndex("idx_pulses_workflow")
		.ifNotExists()
		.on("pulses")
		.column("workflow_id")
		.execute();

	// Index for finding pulses by status
	await db.schema
		.createIndex("idx_pulses_status")
		.ifNotExists()
		.on("pulses")
		.column("status")
		.execute();
}

// =============================================================================
// Preflight Setup
// =============================================================================

async function createPreflightSetupTable(
	db: Kysely<ProjectDatabase>,
): Promise<void> {
	await db.schema
		.createTable("preflight_setup")
		.ifNotExists()
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("workflow_id", "text", (col) =>
			col.notNull().references("workflows.id"),
		)
		.addColumn("session_id", "text")
		.addColumn("status", "text", (col) => col.notNull().defaultTo("running"))
		.addColumn("progress_message", "text")
		.addColumn("error_message", "text")
		.addColumn("created_at", "integer", (col) => col.notNull())
		.addColumn("completed_at", "integer")
		.execute();

	// Index for finding preflight by workflow
	await db.schema
		.createIndex("idx_preflight_setup_workflow")
		.ifNotExists()
		.on("preflight_setup")
		.column("workflow_id")
		.execute();
}

// =============================================================================
// Preflight Baselines
// =============================================================================

async function createPreflightBaselinesTable(
	db: Kysely<ProjectDatabase>,
): Promise<void> {
	await db.schema
		.createTable("preflight_baselines")
		.ifNotExists()
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("workflow_id", "text", (col) =>
			col.notNull().references("workflows.id"),
		)
		.addColumn("issue_type", "text", (col) => col.notNull())
		.addColumn("source", "text", (col) => col.notNull())
		.addColumn("pattern", "text", (col) => col.notNull())
		.addColumn("file_path", "text")
		.addColumn("description", "text")
		.addColumn("recorded_at", "integer", (col) => col.notNull())
		.execute();

	// Index for finding baselines by workflow
	await db.schema
		.createIndex("idx_preflight_baselines_workflow")
		.ifNotExists()
		.on("preflight_baselines")
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
		.addColumn("hidden", "integer", (col) => col.notNull().defaultTo(0))
		.addColumn("created_at", "integer", (col) => col.notNull())
		.addColumn("completed_at", "integer")
		.execute();

	await db.schema
		.createIndex("idx_turns_session")
		.ifNotExists()
		.on("turns")
		.column("session_id")
		.execute();

	// Add hidden column to existing tables (migration for existing databases)
	try {
		await db.schema
			.alterTable("turns")
			.addColumn("hidden", "integer", (col) => col.notNull().defaultTo(0))
			.execute();
	} catch {
		// Column already exists, ignore
	}
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
// Artifact Status Migrations
// =============================================================================

async function addArtifactStatusColumns(
	db: Kysely<ProjectDatabase>,
): Promise<void> {
	// Add status column to scope_cards
	try {
		await db.schema
			.alterTable("scope_cards")
			.addColumn("status", "text", (col) => col.notNull().defaultTo("pending"))
			.execute();
	} catch {
		// Column already exists, ignore
	}

	// Add status column to research_cards
	try {
		await db.schema
			.alterTable("research_cards")
			.addColumn("status", "text", (col) => col.notNull().defaultTo("pending"))
			.execute();
	} catch {
		// Column already exists, ignore
	}

	// Add status column to plans
	try {
		await db.schema
			.alterTable("plans")
			.addColumn("status", "text", (col) => col.notNull().defaultTo("pending"))
			.execute();
	} catch {
		// Column already exists, ignore
	}
}

// =============================================================================
// Verification Instructions Migration
// =============================================================================

async function addVerificationInstructionsColumn(
	db: Kysely<ProjectDatabase>,
): Promise<void> {
	// Add verification_instructions column to preflight_setup
	try {
		await db.schema
			.alterTable("preflight_setup")
			.addColumn("verification_instructions", "text")
			.execute();
	} catch {
		// Column already exists, ignore
	}
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

// =============================================================================
// Base Branch Migration
// =============================================================================

async function addBaseBranchColumn(db: Kysely<ProjectDatabase>): Promise<void> {
	// Add base_branch column to workflows table
	try {
		await db.schema
			.alterTable("workflows")
			.addColumn("base_branch", "text")
			.execute();
	} catch {
		// Column already exists, ignore
	}
}

// =============================================================================
// Review Cards
// =============================================================================

async function createReviewCardsTable(
	db: Kysely<ProjectDatabase>,
): Promise<void> {
	await db.schema
		.createTable("review_cards")
		.ifNotExists()
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("workflow_id", "text", (col) =>
			col.notNull().references("workflows.id"),
		)
		.addColumn("recommendation", "text") // approve, deny, manual_review - nullable until completeReview
		.addColumn("summary", "text") // Nullable until completeReview
		.addColumn("status", "text", (col) => col.notNull().defaultTo("pending"))
		.addColumn("created_at", "integer", (col) => col.notNull())
		.execute();

	await db.schema
		.createIndex("idx_review_cards_workflow")
		.ifNotExists()
		.on("review_cards")
		.column("workflow_id")
		.execute();
}

// =============================================================================
// Review Comments
// =============================================================================

async function createReviewCommentsTable(
	db: Kysely<ProjectDatabase>,
): Promise<void> {
	await db.schema
		.createTable("review_comments")
		.ifNotExists()
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("review_card_id", "text", (col) =>
			col.notNull().references("review_cards.id"),
		)
		.addColumn("type", "text", (col) => col.notNull()) // line, file, review
		.addColumn("file_path", "text") // Nullable for review-level comments
		.addColumn("start_line", "integer") // Nullable for file/review-level comments
		.addColumn("end_line", "integer") // Nullable (optional even for line comments)
		.addColumn("severity", "text", (col) => col.notNull()) // High, Medium, Low
		.addColumn("category", "text", (col) => col.notNull())
		.addColumn("description", "text", (col) => col.notNull())
		.addColumn("created_at", "integer", (col) => col.notNull())
		.execute();

	// Index for finding comments by review card
	await db.schema
		.createIndex("idx_review_comments_card")
		.ifNotExists()
		.on("review_comments")
		.column("review_card_id")
		.execute();
}

// =============================================================================
// Artifact Turn ID Migration
// =============================================================================

async function addArtifactTurnIdColumns(
	db: Kysely<ProjectDatabase>,
): Promise<void> {
	// Add turn_id column to scope_cards
	try {
		await db.schema
			.alterTable("scope_cards")
			.addColumn("turn_id", "text")
			.execute();
	} catch {
		// Column already exists, ignore
	}

	// Add turn_id column to research_cards
	try {
		await db.schema
			.alterTable("research_cards")
			.addColumn("turn_id", "text")
			.execute();
	} catch {
		// Column already exists, ignore
	}

	// Add turn_id column to plans
	try {
		await db.schema
			.alterTable("plans")
			.addColumn("turn_id", "text")
			.execute();
	} catch {
		// Column already exists, ignore
	}

	// Add turn_id column to review_cards
	try {
		await db.schema
			.alterTable("review_cards")
			.addColumn("turn_id", "text")
			.execute();
	} catch {
		// Column already exists, ignore
	}
}
