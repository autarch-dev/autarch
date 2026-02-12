/**
 * Tests for SessionRepository
 *
 * Tests all 8 public methods: create, getById, getActiveById, getByContext,
 * getActiveByContext, updateStatus, deleteSession, deleteByContextAndRoles.
 * Uses createTestDb() in beforeEach for a fresh in-memory database per test.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { Kysely } from "kysely";
import type { ProjectDatabase } from "../../db/project/types";
import { ids } from "../../utils/ids";
import type { Repositories } from "../types";
import { createTestDb, destroyTestDb } from "./helper";

let db: Kysely<ProjectDatabase>;
let repos: Repositories;

beforeEach(async () => {
	const testDb = await createTestDb();
	db = testDb.db;
	repos = testDb.repos;
});

afterEach(async () => {
	await destroyTestDb(db);
});

/**
 * Helper: create a workflow so sessions have a valid context_id FK target.
 */
async function createWorkflow(): Promise<string> {
	const workflow = await repos.workflows.create({
		title: "Test workflow",
		description: "For session tests",
	});
	return workflow.id;
}

describe("SessionRepository", () => {
	describe("create", () => {
		test("creates a session and returns it with correct fields", async () => {
			const workflowId = await createWorkflow();

			const session = await repos.sessions.create({
				contextType: "workflow",
				contextId: workflowId,
				agentRole: "scoping",
			});

			expect(session.id).toMatch(/^session_/);
			expect(session.contextType).toBe("workflow");
			expect(session.contextId).toBe(workflowId);
			expect(session.agentRole).toBe("scoping");
			expect(session.status).toBe("active");
			expect(session.pulseId).toBeUndefined();
			expect(typeof session.createdAt).toBe("number");
			expect(typeof session.updatedAt).toBe("number");
		});

		test("creates a session with optional pulseId", async () => {
			const workflowId = await createWorkflow();
			const pulseId = ids.pulse();

			// Insert a pulse row for FK validity
			await db
				.insertInto("pulses")
				.values({
					id: pulseId,
					workflow_id: workflowId,
					planned_pulse_id: null,
					status: "running",
					description: null,
					pulse_branch: null,
					worktree_path: null,
					checkpoint_commit_sha: null,
					diff_artifact_id: null,
					has_unresolved_issues: 0,
					is_recovery_checkpoint: 0,
					rejection_count: 0,
					created_at: Date.now(),
					started_at: null,
					ended_at: null,
					failure_reason: null,
				})
				.execute();

			const session = await repos.sessions.create({
				contextType: "workflow",
				contextId: workflowId,
				agentRole: "executor",
				pulseId,
			});

			expect(session.pulseId).toBe(pulseId);
		});
	});

	describe("getById", () => {
		test("retrieves a session by ID with all fields", async () => {
			const workflowId = await createWorkflow();
			const created = await repos.sessions.create({
				contextType: "workflow",
				contextId: workflowId,
				agentRole: "scoping",
			});

			const found = await repos.sessions.getById(created.id);

			expect(found).not.toBeNull();
			expect(found?.id).toBe(created.id);
			expect(found?.contextType).toBe("workflow");
			expect(found?.contextId).toBe(workflowId);
			expect(found?.agentRole).toBe("scoping");
			expect(found?.status).toBe("active");
			expect(found?.createdAt).toBe(created.createdAt);
			expect(found?.updatedAt).toBe(created.updatedAt);
		});

		test("returns null for non-existent ID", async () => {
			const found = await repos.sessions.getById("session_nonexistent_000000");

			expect(found).toBeNull();
		});
	});

	describe("getActiveById", () => {
		test("retrieves an active session by ID", async () => {
			const workflowId = await createWorkflow();
			const created = await repos.sessions.create({
				contextType: "workflow",
				contextId: workflowId,
				agentRole: "scoping",
			});

			const found = await repos.sessions.getActiveById(created.id);

			expect(found).not.toBeNull();
			expect(found?.id).toBe(created.id);
			expect(found?.status).toBe("active");
		});

		test("returns null for a completed session", async () => {
			const workflowId = await createWorkflow();
			const created = await repos.sessions.create({
				contextType: "workflow",
				contextId: workflowId,
				agentRole: "scoping",
			});

			await repos.sessions.updateStatus(created.id, "completed");

			const found = await repos.sessions.getActiveById(created.id);

			expect(found).toBeNull();
		});
	});

	describe("getByContext", () => {
		test("returns all sessions for a context", async () => {
			const workflowId = await createWorkflow();
			const session1 = await repos.sessions.create({
				contextType: "workflow",
				contextId: workflowId,
				agentRole: "scoping",
			});
			const session2 = await repos.sessions.create({
				contextType: "workflow",
				contextId: workflowId,
				agentRole: "researching",
			});

			const sessions = await repos.sessions.getByContext(
				"workflow",
				workflowId,
			);

			expect(sessions).toHaveLength(2);
			expect(sessions[0]?.id).toBe(session1.id);
			expect(sessions[1]?.id).toBe(session2.id);
		});
	});

	describe("getActiveByContext", () => {
		test("returns only the active session for a context", async () => {
			const workflowId = await createWorkflow();
			const session1 = await repos.sessions.create({
				contextType: "workflow",
				contextId: workflowId,
				agentRole: "scoping",
			});
			await repos.sessions.create({
				contextType: "workflow",
				contextId: workflowId,
				agentRole: "researching",
			});

			// Complete the second session
			const sessions = await repos.sessions.getByContext(
				"workflow",
				workflowId,
			);
			await repos.sessions.updateStatus(sessions[1]?.id ?? "", "completed");

			const active = await repos.sessions.getActiveByContext(
				"workflow",
				workflowId,
			);

			expect(active).not.toBeNull();
			expect(active?.id).toBe(session1.id);
		});
	});

	describe("updateStatus", () => {
		test("updates session status to completed", async () => {
			const workflowId = await createWorkflow();
			const session = await repos.sessions.create({
				contextType: "workflow",
				contextId: workflowId,
				agentRole: "scoping",
			});

			await repos.sessions.updateStatus(session.id, "completed");

			const found = await repos.sessions.getById(session.id);
			expect(found?.status).toBe("completed");
		});
	});

	describe("deleteSession", () => {
		test("deletes session and all associated data across 9 tables", async () => {
			const workflowId = await createWorkflow();
			const now = Date.now();

			// Create session
			const session = await repos.sessions.create({
				contextType: "workflow",
				contextId: workflowId,
				agentRole: "executor",
			});

			// Create turn
			const turnId = ids.turn();
			await db
				.insertInto("turns")
				.values({
					id: turnId,
					session_id: session.id,
					turn_index: 0,
					role: "assistant",
					status: "completed",
					token_count: 100,
					prompt_tokens: 50,
					completion_tokens: 50,
					model_id: "test-model",
					hidden: 0,
					created_at: now,
					completed_at: now,
				})
				.execute();

			// Create turn_messages
			const messageId = ids.message();
			await db
				.insertInto("turn_messages")
				.values({
					id: messageId,
					turn_id: turnId,
					message_index: 0,
					content: "Hello",
					created_at: now,
				})
				.execute();

			// Create turn_tools
			const toolId = ids.todo();
			await db
				.insertInto("turn_tools")
				.values({
					id: toolId,
					turn_id: turnId,
					tool_index: 0,
					tool_name: "read_file",
					reason: "test",
					input_json: "{}",
					output_json: "{}",
					status: "completed",
					started_at: now,
					completed_at: now,
				})
				.execute();

			// Create turn_thoughts
			const thoughtId = ids.thought();
			await db
				.insertInto("turn_thoughts")
				.values({
					id: thoughtId,
					turn_id: turnId,
					thought_index: 0,
					content: "Thinking...",
					created_at: now,
				})
				.execute();

			// Create questions
			const questionId = ids.question();
			await db
				.insertInto("questions")
				.values({
					id: questionId,
					session_id: session.id,
					turn_id: turnId,
					question_index: 0,
					type: "free_text",
					prompt: "What next?",
					options_json: null,
					answer_json: null,
					status: "pending",
					created_at: now,
					answered_at: null,
				})
				.execute();

			// Create session_notes
			const noteId = ids.note();
			await db
				.insertInto("session_notes")
				.values({
					id: noteId,
					session_id: session.id,
					context_type: "workflow",
					context_id: workflowId,
					content: "A note",
					created_at: now,
				})
				.execute();

			// Create session_todos
			const todoId = ids.todo();
			await db
				.insertInto("session_todos")
				.values({
					id: todoId,
					session_id: session.id,
					context_type: "workflow",
					context_id: workflowId,
					title: "A todo",
					description: "Do something",
					checked: 0,
					sort_order: 0,
					created_at: now,
				})
				.execute();

			// Create subtasks
			const subtaskId = ids.subtask();
			await db
				.insertInto("subtasks")
				.values({
					id: subtaskId,
					parent_session_id: session.id,
					workflow_id: workflowId,
					task_definition: '{"task":"test"}',
					findings: null,
					status: "pending",
					created_at: now,
					updated_at: now,
				})
				.execute();

			// --- Execute deleteSession ---
			await repos.sessions.deleteSession(session.id);

			// --- Verify all 9 tables are cleaned up ---
			const remainingSessions = await db
				.selectFrom("sessions")
				.selectAll()
				.where("id", "=", session.id)
				.execute();
			expect(remainingSessions).toHaveLength(0);

			const remainingTurns = await db
				.selectFrom("turns")
				.selectAll()
				.where("id", "=", turnId)
				.execute();
			expect(remainingTurns).toHaveLength(0);

			const remainingMessages = await db
				.selectFrom("turn_messages")
				.selectAll()
				.where("id", "=", messageId)
				.execute();
			expect(remainingMessages).toHaveLength(0);

			const remainingTools = await db
				.selectFrom("turn_tools")
				.selectAll()
				.where("id", "=", toolId)
				.execute();
			expect(remainingTools).toHaveLength(0);

			const remainingThoughts = await db
				.selectFrom("turn_thoughts")
				.selectAll()
				.where("id", "=", thoughtId)
				.execute();
			expect(remainingThoughts).toHaveLength(0);

			const remainingQuestions = await db
				.selectFrom("questions")
				.selectAll()
				.where("id", "=", questionId)
				.execute();
			expect(remainingQuestions).toHaveLength(0);

			const remainingNotes = await db
				.selectFrom("session_notes")
				.selectAll()
				.where("id", "=", noteId)
				.execute();
			expect(remainingNotes).toHaveLength(0);

			const remainingTodos = await db
				.selectFrom("session_todos")
				.selectAll()
				.where("id", "=", todoId)
				.execute();
			expect(remainingTodos).toHaveLength(0);

			const remainingSubtasks = await db
				.selectFrom("subtasks")
				.selectAll()
				.where("id", "=", subtaskId)
				.execute();
			expect(remainingSubtasks).toHaveLength(0);
		});
	});

	describe("deleteByContextAndRoles", () => {
		test("deletes only sessions matching context and roles", async () => {
			const workflowId = await createWorkflow();

			// Create sessions with different roles
			const scopingSession = await repos.sessions.create({
				contextType: "workflow",
				contextId: workflowId,
				agentRole: "scoping",
			});
			const researchSession = await repos.sessions.create({
				contextType: "workflow",
				contextId: workflowId,
				agentRole: "researching",
			});
			const executorSession = await repos.sessions.create({
				contextType: "workflow",
				contextId: workflowId,
				agentRole: "executor",
			});

			// Delete scoping and researching sessions
			const count = await repos.sessions.deleteByContextAndRoles(
				"workflow",
				workflowId,
				["scoping", "researching"],
			);

			expect(count).toBe(2);

			// Verify scoping and researching sessions are gone
			const scoping = await repos.sessions.getById(scopingSession.id);
			expect(scoping).toBeNull();

			const research = await repos.sessions.getById(researchSession.id);
			expect(research).toBeNull();

			// Verify executor session remains
			const executor = await repos.sessions.getById(executorSession.id);
			expect(executor).not.toBeNull();
			expect(executor?.agentRole).toBe("executor");
		});
	});
});
