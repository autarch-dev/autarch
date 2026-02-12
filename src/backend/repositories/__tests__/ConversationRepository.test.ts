/**
 * Tests for ConversationRepository
 *
 * Tests ~28 public methods covering: getHistory, turn lifecycle,
 * message CRUD, tool tracking, thoughts, questions, notes, todos,
 * and session context loading.
 * Uses createTestDb() in beforeEach for a fresh in-memory database per test.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { Kysely } from "kysely";
import type { ProjectDatabase, QuestionsTable } from "../../db/project/types";
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
 * Helper: create a workflow + session so conversation methods have valid parent rows.
 * Returns the workflow ID and session ID.
 */
async function createTestSession(): Promise<{
	workflowId: string;
	sessionId: string;
}> {
	const workflow = await repos.workflows.create({
		title: "Test workflow",
		description: "For conversation tests",
	});
	const session = await repos.sessions.create({
		contextType: "workflow",
		contextId: workflow.id,
		agentRole: "scoping",
	});
	return { workflowId: workflow.id, sessionId: session.id };
}

describe("ConversationRepository", () => {
	// =========================================================================
	// getHistory
	// =========================================================================

	describe("getHistory", () => {
		test("returns only visible turns with nested messages, tools, thoughts, and questions", async () => {
			const { workflowId, sessionId } = await createTestSession();
			const now = Date.now();

			// Create a visible turn
			const visibleTurnId = ids.turn();
			await db
				.insertInto("turns")
				.values({
					id: visibleTurnId,
					session_id: sessionId,
					turn_index: 0,
					role: "assistant",
					status: "completed",
					token_count: 100,
					prompt_tokens: 50,
					completion_tokens: 50,
					model_id: "test-model",
					hidden: 0,
					created_at: now,
					completed_at: now + 1000,
				})
				.execute();

			// Create a hidden turn
			const hiddenTurnId = ids.turn();
			await db
				.insertInto("turns")
				.values({
					id: hiddenTurnId,
					session_id: sessionId,
					turn_index: 1,
					role: "assistant",
					status: "completed",
					token_count: 50,
					prompt_tokens: 25,
					completion_tokens: 25,
					model_id: "test-model",
					hidden: 1,
					created_at: now + 2000,
					completed_at: now + 3000,
				})
				.execute();

			// Add messages to both turns
			await db
				.insertInto("turn_messages")
				.values({
					id: ids.message(),
					turn_id: visibleTurnId,
					message_index: 0,
					content: "Visible message",
					created_at: now,
				})
				.execute();
			await db
				.insertInto("turn_messages")
				.values({
					id: ids.message(),
					turn_id: hiddenTurnId,
					message_index: 0,
					content: "Hidden message",
					created_at: now + 2000,
				})
				.execute();

			// Add a tool call to the visible turn
			await db
				.insertInto("turn_tools")
				.values({
					id: ids.thought(),
					turn_id: visibleTurnId,
					tool_index: 0,
					tool_name: "read_file",
					reason: "Read a file",
					input_json: JSON.stringify({ path: "test.ts" }),
					output_json: JSON.stringify("file contents"),
					status: "completed",
					started_at: now,
					completed_at: now + 500,
				})
				.execute();

			// Add a thought to the visible turn
			await db
				.insertInto("turn_thoughts")
				.values({
					id: ids.thought(),
					turn_id: visibleTurnId,
					thought_index: 0,
					content: "Thinking about the problem...",
					created_at: now,
				})
				.execute();

			// Add a question to the visible turn
			await db
				.insertInto("questions")
				.values({
					id: ids.question(),
					session_id: sessionId,
					turn_id: visibleTurnId,
					question_index: 0,
					type: "single_select",
					prompt: "Which option?",
					options_json: JSON.stringify(["A", "B", "C"]),
					answer_json: null,
					status: "pending",
					created_at: now,
					answered_at: null,
				})
				.execute();

			// Add a tool and thought to the hidden turn too (should not appear)
			await db
				.insertInto("turn_tools")
				.values({
					id: ids.thought(),
					turn_id: hiddenTurnId,
					tool_index: 0,
					tool_name: "write_file",
					reason: null,
					input_json: JSON.stringify({ path: "hidden.ts" }),
					output_json: null,
					status: "running",
					started_at: now + 2000,
					completed_at: null,
				})
				.execute();
			await db
				.insertInto("turn_thoughts")
				.values({
					id: ids.thought(),
					turn_id: hiddenTurnId,
					thought_index: 0,
					content: "Hidden thought",
					created_at: now + 2000,
				})
				.execute();

			const history = await repos.conversations.getHistory(
				"workflow",
				workflowId,
			);

			// Should have one session
			expect(history.sessions).toHaveLength(1);
			expect(history.sessions[0]?.id).toBe(sessionId);

			// Should have exactly 1 message (the visible turn)
			expect(history.messages).toHaveLength(1);

			const msg = history.messages[0];
			expect(msg?.turnId).toBe(visibleTurnId);
			expect(msg?.role).toBe("assistant");

			// Segments should contain the visible message
			expect(msg?.segments).toHaveLength(1);
			expect(msg?.segments[0]?.content).toBe("Visible message");

			// Tool calls should be present
			expect(msg?.toolCalls).toHaveLength(1);
			expect(msg?.toolCalls?.[0]?.name).toBe("read_file");
			expect(msg?.toolCalls?.[0]?.status).toBe("completed");

			// Thought should be present
			expect(msg?.thought).toBe("Thinking about the problem...");

			// Questions should be present
			expect(msg?.questions).toHaveLength(1);
			expect(msg?.questions?.[0]?.prompt).toBe("Which option?");
			expect(msg?.questions?.[0]?.type).toBe("single_select");

			// Active session info
			expect(history.activeSessionId).toBe(sessionId);
			expect(history.activeSessionStatus).toBe("active");
		});
	});

	// =========================================================================
	// Turn Lifecycle
	// =========================================================================

	describe("createTurn", () => {
		test("creates a turn and returns it with camelCase fields", async () => {
			const { sessionId } = await createTestSession();

			const turn = await repos.conversations.createTurn({
				sessionId,
				turnIndex: 0,
				role: "user",
			});

			expect(turn.id).toMatch(/^turn_/);
			expect(turn.sessionId).toBe(sessionId);
			expect(turn.turnIndex).toBe(0);
			expect(turn.role).toBe("user");
			expect(turn.status).toBe("streaming");
			expect(turn.tokenCount).toBeNull();
			expect(turn.promptTokens).toBeNull();
			expect(turn.completionTokens).toBeNull();
			expect(turn.modelId).toBeNull();
			expect(typeof turn.createdAt).toBe("number");
			expect(turn.completedAt).toBeNull();
		});
	});

	describe("completeTurn", () => {
		test("marks a turn as completed with completedAt timestamp", async () => {
			const { sessionId } = await createTestSession();
			const turn = await repos.conversations.createTurn({
				sessionId,
				turnIndex: 0,
				role: "assistant",
			});

			await repos.conversations.completeTurn(turn.id, {
				tokenCount: 200,
				promptTokens: 100,
				completionTokens: 100,
				modelId: "gpt-4",
			});

			// Read back from DB to verify
			const rows = await db
				.selectFrom("turns")
				.selectAll()
				.where("id", "=", turn.id)
				.execute();

			expect(rows).toHaveLength(1);
			expect(rows[0]?.status).toBe("completed");
			expect(rows[0]?.completed_at).not.toBeNull();
			expect(rows[0]?.token_count).toBe(200);
			expect(rows[0]?.prompt_tokens).toBe(100);
			expect(rows[0]?.completion_tokens).toBe(100);
			expect(rows[0]?.model_id).toBe("gpt-4");
		});
	});

	describe("errorTurn", () => {
		test("marks a turn as errored with completedAt timestamp", async () => {
			const { sessionId } = await createTestSession();
			const turn = await repos.conversations.createTurn({
				sessionId,
				turnIndex: 0,
				role: "assistant",
			});

			await repos.conversations.errorTurn(turn.id);

			const rows = await db
				.selectFrom("turns")
				.selectAll()
				.where("id", "=", turn.id)
				.execute();

			expect(rows).toHaveLength(1);
			expect(rows[0]?.status).toBe("error");
			expect(rows[0]?.completed_at).not.toBeNull();
		});
	});

	describe("getCompletedTurns", () => {
		test("returns only completed turns for a session", async () => {
			const { sessionId } = await createTestSession();

			// Create 3 turns with different statuses
			const completedTurn = await repos.conversations.createTurn({
				sessionId,
				turnIndex: 0,
				role: "assistant",
			});
			await repos.conversations.completeTurn(completedTurn.id);

			const erroredTurn = await repos.conversations.createTurn({
				sessionId,
				turnIndex: 1,
				role: "assistant",
			});
			await repos.conversations.errorTurn(erroredTurn.id);

			// This one stays as "streaming" (active)
			await repos.conversations.createTurn({
				sessionId,
				turnIndex: 2,
				role: "assistant",
			});

			const completed = await repos.conversations.getCompletedTurns(sessionId);

			expect(completed).toHaveLength(1);
			expect(completed[0]?.id).toBe(completedTurn.id);
			expect(completed[0]?.status).toBe("completed");
		});
	});

	// =========================================================================
	// Message CRUD
	// =========================================================================

	describe("saveMessage", () => {
		test("saves a message segment for a turn", async () => {
			const { sessionId } = await createTestSession();
			const turn = await repos.conversations.createTurn({
				sessionId,
				turnIndex: 0,
				role: "assistant",
			});

			await repos.conversations.saveMessage(turn.id, 0, "Hello, world!");

			const messages = await repos.conversations.getMessages(turn.id);
			expect(messages).toHaveLength(1);
			expect(messages[0]?.turn_id).toBe(turn.id);
			expect(messages[0]?.message_index).toBe(0);
			expect(messages[0]?.content).toBe("Hello, world!");
			expect(messages[0]?.id).toMatch(/^message_/);
		});
	});

	describe("updateMessage", () => {
		test("updates the content of an existing message", async () => {
			const { sessionId } = await createTestSession();
			const turn = await repos.conversations.createTurn({
				sessionId,
				turnIndex: 0,
				role: "assistant",
			});

			await repos.conversations.saveMessage(turn.id, 0, "Original content");
			await repos.conversations.updateMessage(turn.id, 0, "Updated content");

			const messages = await repos.conversations.getMessages(turn.id);
			expect(messages).toHaveLength(1);
			expect(messages[0]?.content).toBe("Updated content");
		});
	});

	describe("upsertMessage", () => {
		test("inserts a new message when none exists at the index", async () => {
			const { sessionId } = await createTestSession();
			const turn = await repos.conversations.createTurn({
				sessionId,
				turnIndex: 0,
				role: "assistant",
			});

			await repos.conversations.upsertMessage(turn.id, 0, "New message");

			const messages = await repos.conversations.getMessages(turn.id);
			expect(messages).toHaveLength(1);
			expect(messages[0]?.content).toBe("New message");
		});

		test("updates an existing message when one exists at the index", async () => {
			const { sessionId } = await createTestSession();
			const turn = await repos.conversations.createTurn({
				sessionId,
				turnIndex: 0,
				role: "assistant",
			});

			await repos.conversations.upsertMessage(turn.id, 0, "First version");
			await repos.conversations.upsertMessage(turn.id, 0, "Second version");

			const messages = await repos.conversations.getMessages(turn.id);
			expect(messages).toHaveLength(1);
			expect(messages[0]?.content).toBe("Second version");
		});
	});

	describe("getMessages", () => {
		test("returns messages for a turn ordered by message_index", async () => {
			const { sessionId } = await createTestSession();
			const turn = await repos.conversations.createTurn({
				sessionId,
				turnIndex: 0,
				role: "assistant",
			});

			await repos.conversations.saveMessage(turn.id, 0, "First segment");
			await repos.conversations.saveMessage(turn.id, 1, "Second segment");

			const messages = await repos.conversations.getMessages(turn.id);
			expect(messages).toHaveLength(2);
			expect(messages[0]?.message_index).toBe(0);
			expect(messages[0]?.content).toBe("First segment");
			expect(messages[1]?.message_index).toBe(1);
			expect(messages[1]?.content).toBe("Second segment");
		});
	});

	// =========================================================================
	// Tool Tracking
	// =========================================================================

	describe("recordToolStart", () => {
		test("records a tool call with running status", async () => {
			const { sessionId } = await createTestSession();
			const turn = await repos.conversations.createTurn({
				sessionId,
				turnIndex: 0,
				role: "assistant",
			});

			const toolId = await repos.conversations.recordToolStart({
				id: ids.thought(),
				turnId: turn.id,
				toolIndex: 0,
				toolName: "read_file",
				reason: "Reading source file",
				input: { path: "src/index.ts" },
			});

			expect(typeof toolId).toBe("string");

			const tools = await repos.conversations.getTools(turn.id);
			expect(tools).toHaveLength(1);
			expect(tools[0]?.id).toBe(toolId);
			expect(tools[0]?.tool_name).toBe("read_file");
			expect(tools[0]?.status).toBe("running");
			expect(tools[0]?.reason).toBe("Reading source file");
			expect(tools[0]?.output_json).toBeNull();
		});
	});

	describe("recordToolComplete", () => {
		test("completes a tool call with output and success status", async () => {
			const { sessionId } = await createTestSession();
			const turn = await repos.conversations.createTurn({
				sessionId,
				turnIndex: 0,
				role: "assistant",
			});

			const toolId = await repos.conversations.recordToolStart({
				turnId: turn.id,
				toolIndex: 0,
				toolName: "read_file",
				reason: null,
				input: { path: "test.ts" },
			});

			await repos.conversations.recordToolComplete(
				toolId,
				"file contents here",
				true,
			);

			const tools = await repos.conversations.getTools(turn.id);
			expect(tools).toHaveLength(1);
			expect(tools[0]?.status).toBe("completed");
			expect(tools[0]?.completed_at).not.toBeNull();
			expect(tools[0]?.output_json).not.toBeNull();
		});
	});

	describe("getTools", () => {
		test("returns all tools for a turn ordered by tool_index", async () => {
			const { sessionId } = await createTestSession();
			const turn = await repos.conversations.createTurn({
				sessionId,
				turnIndex: 0,
				role: "assistant",
			});

			await repos.conversations.recordToolStart({
				turnId: turn.id,
				toolIndex: 0,
				toolName: "read_file",
				reason: null,
				input: { path: "a.ts" },
			});
			await repos.conversations.recordToolStart({
				turnId: turn.id,
				toolIndex: 1,
				toolName: "write_file",
				reason: null,
				input: { path: "b.ts", content: "hello" },
			});

			const tools = await repos.conversations.getTools(turn.id);
			expect(tools).toHaveLength(2);
			expect(tools[0]?.tool_index).toBe(0);
			expect(tools[0]?.tool_name).toBe("read_file");
			expect(tools[1]?.tool_index).toBe(1);
			expect(tools[1]?.tool_name).toBe("write_file");
		});
	});

	describe("getToolNames", () => {
		test("returns an array of tool names for a turn", async () => {
			const { sessionId } = await createTestSession();
			const turn = await repos.conversations.createTurn({
				sessionId,
				turnIndex: 0,
				role: "assistant",
			});

			await repos.conversations.recordToolStart({
				turnId: turn.id,
				toolIndex: 0,
				toolName: "semantic_search",
				reason: null,
				input: { query: "test" },
			});
			await repos.conversations.recordToolStart({
				turnId: turn.id,
				toolIndex: 1,
				toolName: "grep",
				reason: null,
				input: { pattern: "foo" },
			});

			const names = await repos.conversations.getToolNames(turn.id);
			expect(names).toHaveLength(2);
			expect(names).toContain("semantic_search");
			expect(names).toContain("grep");
		});
	});

	describe("getSucceededToolNames", () => {
		test("returns only names of tools with completed status", async () => {
			const { sessionId } = await createTestSession();
			const turn = await repos.conversations.createTurn({
				sessionId,
				turnIndex: 0,
				role: "assistant",
			});

			// Tool 1: succeeded
			const tool1Id = await repos.conversations.recordToolStart({
				turnId: turn.id,
				toolIndex: 0,
				toolName: "read_file",
				reason: null,
				input: { path: "a.ts" },
			});
			await repos.conversations.recordToolComplete(
				tool1Id,
				"contents of a",
				true,
			);

			// Tool 2: succeeded
			const tool2Id = await repos.conversations.recordToolStart({
				turnId: turn.id,
				toolIndex: 1,
				toolName: "write_file",
				reason: null,
				input: { path: "b.ts", content: "data" },
			});
			await repos.conversations.recordToolComplete(
				tool2Id,
				"written successfully",
				true,
			);

			// Tool 3: failed
			const tool3Id = await repos.conversations.recordToolStart({
				turnId: turn.id,
				toolIndex: 2,
				toolName: "shell",
				reason: null,
				input: { command: "exit 1" },
			});
			await repos.conversations.recordToolComplete(
				tool3Id,
				"command failed",
				false,
			);

			const succeeded = await repos.conversations.getSucceededToolNames(
				turn.id,
			);
			expect(succeeded).toHaveLength(2);
			expect(succeeded).toContain("read_file");
			expect(succeeded).toContain("write_file");
			expect(succeeded).not.toContain("shell");
		});
	});

	// =========================================================================
	// Thoughts (Extended Thinking)
	// =========================================================================

	describe("saveThought", () => {
		test("saves a thought and verifies it in the database", async () => {
			const { sessionId } = await createTestSession();
			const turn = await repos.conversations.createTurn({
				sessionId,
				turnIndex: 0,
				role: "assistant",
			});

			await repos.conversations.saveThought(
				turn.id,
				0,
				"Analyzing the problem...",
			);

			const rows = await db
				.selectFrom("turn_thoughts")
				.selectAll()
				.where("turn_id", "=", turn.id)
				.execute();

			expect(rows).toHaveLength(1);
			expect(rows[0]?.id).toMatch(/^thought_/);
			expect(rows[0]?.turn_id).toBe(turn.id);
			expect(rows[0]?.thought_index).toBe(0);
			expect(rows[0]?.content).toBe("Analyzing the problem...");
			expect(typeof rows[0]?.created_at).toBe("number");
		});
	});

	describe("updateThought", () => {
		test("updates the content of an existing thought", async () => {
			const { sessionId } = await createTestSession();
			const turn = await repos.conversations.createTurn({
				sessionId,
				turnIndex: 0,
				role: "assistant",
			});

			await repos.conversations.saveThought(turn.id, 0, "Original thought");
			await repos.conversations.updateThought(turn.id, 0, "Updated thought");

			const rows = await db
				.selectFrom("turn_thoughts")
				.selectAll()
				.where("turn_id", "=", turn.id)
				.execute();

			expect(rows).toHaveLength(1);
			expect(rows[0]?.content).toBe("Updated thought");
		});
	});

	describe("upsertThought", () => {
		test("inserts a new thought when none exists at the index", async () => {
			const { sessionId } = await createTestSession();
			const turn = await repos.conversations.createTurn({
				sessionId,
				turnIndex: 0,
				role: "assistant",
			});

			await repos.conversations.upsertThought(turn.id, 0, "New thought");

			const rows = await db
				.selectFrom("turn_thoughts")
				.selectAll()
				.where("turn_id", "=", turn.id)
				.execute();

			expect(rows).toHaveLength(1);
			expect(rows[0]?.content).toBe("New thought");
		});

		test("updates an existing thought when one exists at the index", async () => {
			const { sessionId } = await createTestSession();
			const turn = await repos.conversations.createTurn({
				sessionId,
				turnIndex: 0,
				role: "assistant",
			});

			await repos.conversations.upsertThought(turn.id, 0, "First version");
			await repos.conversations.upsertThought(turn.id, 0, "Second version");

			const rows = await db
				.selectFrom("turn_thoughts")
				.selectAll()
				.where("turn_id", "=", turn.id)
				.execute();

			expect(rows).toHaveLength(1);
			expect(rows[0]?.content).toBe("Second version");
		});
	});

	// =========================================================================
	// Questions
	// =========================================================================

	describe("getQuestionById", () => {
		test("returns a question by its ID", async () => {
			const { sessionId } = await createTestSession();
			const turn = await repos.conversations.createTurn({
				sessionId,
				turnIndex: 0,
				role: "assistant",
			});

			const questionId = ids.question();
			const now = Date.now();
			await db
				.insertInto("questions")
				.values({
					id: questionId,
					session_id: sessionId,
					turn_id: turn.id,
					question_index: 0,
					type: "single_select",
					prompt: "Which framework?",
					options_json: JSON.stringify(["React", "Vue", "Svelte"]),
					answer_json: null,
					status: "pending",
					created_at: now,
					answered_at: null,
				})
				.execute();

			const question = await repos.conversations.getQuestionById(questionId);

			expect(question).not.toBeNull();
			expect(question?.id).toBe(questionId);
			expect(question?.prompt).toBe("Which framework?");
			expect(question?.type).toBe("single_select");
			expect(question?.status).toBe("pending");
		});

		test("returns null for a non-existent question ID", async () => {
			const question = await repos.conversations.getQuestionById(
				"question_nonexistent",
			);
			expect(question).toBeNull();
		});
	});

	describe("getQuestionsByTurn", () => {
		test("returns all questions for a turn ordered by question_index", async () => {
			const { sessionId } = await createTestSession();
			const turn = await repos.conversations.createTurn({
				sessionId,
				turnIndex: 0,
				role: "assistant",
			});

			const now = Date.now();
			await db
				.insertInto("questions")
				.values({
					id: ids.question(),
					session_id: sessionId,
					turn_id: turn.id,
					question_index: 0,
					type: "single_select",
					prompt: "First question?",
					options_json: JSON.stringify(["A", "B"]),
					answer_json: null,
					status: "pending",
					created_at: now,
					answered_at: null,
				})
				.execute();
			await db
				.insertInto("questions")
				.values({
					id: ids.question(),
					session_id: sessionId,
					turn_id: turn.id,
					question_index: 1,
					type: "free_text",
					prompt: "Second question?",
					options_json: null,
					answer_json: null,
					status: "pending",
					created_at: now + 1,
					answered_at: null,
				})
				.execute();

			const questions = await repos.conversations.getQuestionsByTurn(turn.id);

			expect(questions).toHaveLength(2);
			expect(questions[0]?.question_index).toBe(0);
			expect(questions[0]?.prompt).toBe("First question?");
			expect(questions[1]?.question_index).toBe(1);
			expect(questions[1]?.prompt).toBe("Second question?");
		});
	});

	describe("getPendingQuestions", () => {
		test("returns only pending questions for a session", async () => {
			const { sessionId } = await createTestSession();
			const turn = await repos.conversations.createTurn({
				sessionId,
				turnIndex: 0,
				role: "assistant",
			});

			const now = Date.now();

			// Pending question
			await db
				.insertInto("questions")
				.values({
					id: ids.question(),
					session_id: sessionId,
					turn_id: turn.id,
					question_index: 0,
					type: "single_select",
					prompt: "Pending question?",
					options_json: JSON.stringify(["X", "Y"]),
					answer_json: null,
					status: "pending",
					created_at: now,
					answered_at: null,
				})
				.execute();

			// Answered question (should not be returned)
			await db
				.insertInto("questions")
				.values({
					id: ids.question(),
					session_id: sessionId,
					turn_id: turn.id,
					question_index: 1,
					type: "free_text",
					prompt: "Answered question?",
					options_json: null,
					answer_json: JSON.stringify("Some answer"),
					status: "answered",
					created_at: now + 1,
					answered_at: now + 2,
				})
				.execute();

			const pending = await repos.conversations.getPendingQuestions(sessionId);

			expect(pending).toHaveLength(1);
			expect(pending[0]?.prompt).toBe("Pending question?");
			expect(pending[0]?.status).toBe("pending");
		});
	});

	describe("getPendingQuestionsByTurn", () => {
		test("returns only pending questions for a specific turn", async () => {
			const { sessionId } = await createTestSession();
			const turn1 = await repos.conversations.createTurn({
				sessionId,
				turnIndex: 0,
				role: "assistant",
			});
			const turn2 = await repos.conversations.createTurn({
				sessionId,
				turnIndex: 1,
				role: "assistant",
			});

			const now = Date.now();

			// Pending question on turn1
			await db
				.insertInto("questions")
				.values({
					id: ids.question(),
					session_id: sessionId,
					turn_id: turn1.id,
					question_index: 0,
					type: "single_select",
					prompt: "Turn 1 pending?",
					options_json: JSON.stringify(["A"]),
					answer_json: null,
					status: "pending",
					created_at: now,
					answered_at: null,
				})
				.execute();

			// Pending question on turn2 (should not appear when querying turn1)
			await db
				.insertInto("questions")
				.values({
					id: ids.question(),
					session_id: sessionId,
					turn_id: turn2.id,
					question_index: 0,
					type: "single_select",
					prompt: "Turn 2 pending?",
					options_json: JSON.stringify(["B"]),
					answer_json: null,
					status: "pending",
					created_at: now + 1,
					answered_at: null,
				})
				.execute();

			const pending = await repos.conversations.getPendingQuestionsByTurn(
				turn1.id,
			);

			expect(pending).toHaveLength(1);
			expect(pending[0]?.prompt).toBe("Turn 1 pending?");
		});
	});

	describe("answerQuestion", () => {
		test("marks a question as answered with JSON answer value", async () => {
			const { sessionId } = await createTestSession();
			const turn = await repos.conversations.createTurn({
				sessionId,
				turnIndex: 0,
				role: "assistant",
			});

			const questionId = ids.question();
			const now = Date.now();
			await db
				.insertInto("questions")
				.values({
					id: questionId,
					session_id: sessionId,
					turn_id: turn.id,
					question_index: 0,
					type: "single_select",
					prompt: "Which option?",
					options_json: JSON.stringify(["A", "B", "C"]),
					answer_json: null,
					status: "pending",
					created_at: now,
					answered_at: null,
				})
				.execute();

			await repos.conversations.answerQuestion(questionId, "B");

			const question = await repos.conversations.getQuestionById(questionId);

			expect(question).not.toBeNull();
			expect(question?.status).toBe("answered");
			expect(question?.answer_json).not.toBeNull();
			expect(JSON.parse(question?.answer_json ?? "")).toBe("B");
			expect(question?.answered_at).not.toBeNull();
		});
	});

	describe("skipPendingQuestions", () => {
		test("marks all pending questions for a turn as skipped", async () => {
			const { sessionId } = await createTestSession();
			const turn = await repos.conversations.createTurn({
				sessionId,
				turnIndex: 0,
				role: "assistant",
			});

			const now = Date.now();

			// Two pending questions
			const q1Id = ids.question();
			const q2Id = ids.question();
			await db
				.insertInto("questions")
				.values({
					id: q1Id,
					session_id: sessionId,
					turn_id: turn.id,
					question_index: 0,
					type: "single_select",
					prompt: "Question 1?",
					options_json: JSON.stringify(["A", "B"]),
					answer_json: null,
					status: "pending",
					created_at: now,
					answered_at: null,
				})
				.execute();
			await db
				.insertInto("questions")
				.values({
					id: q2Id,
					session_id: sessionId,
					turn_id: turn.id,
					question_index: 1,
					type: "free_text",
					prompt: "Question 2?",
					options_json: null,
					answer_json: null,
					status: "pending",
					created_at: now + 1,
					answered_at: null,
				})
				.execute();

			const skippedCount = await repos.conversations.skipPendingQuestions(
				turn.id,
			);

			expect(skippedCount).toBe(2);

			const q1 = await repos.conversations.getQuestionById(q1Id);
			const q2 = await repos.conversations.getQuestionById(q2Id);

			expect(q1?.status).toBe("skipped");
			expect(q2?.status).toBe("skipped");
		});
	});

	// =========================================================================
	// formatAnsweredQuestionsMessage
	// =========================================================================

	describe("formatAnsweredQuestionsMessage", () => {
		test("formats answered and skipped questions into a message string", () => {
			const now = Date.now();

			const questions: QuestionsTable[] = [
				{
					id: "question_1",
					session_id: "session_1",
					turn_id: "turn_1",
					question_index: 0,
					type: "single_select",
					prompt: "Which framework?",
					options_json: JSON.stringify(["React", "Vue"]),
					answer_json: JSON.stringify("React"),
					status: "answered",
					created_at: now,
					answered_at: now + 1000,
				},
				{
					id: "question_2",
					session_id: "session_1",
					turn_id: "turn_1",
					question_index: 1,
					type: "free_text",
					prompt: "Any preferences?",
					options_json: null,
					answer_json: null,
					status: "skipped",
					created_at: now,
					answered_at: null,
				},
			];

			const result =
				repos.conversations.formatAnsweredQuestionsMessage(questions);

			// Should contain the answered question
			expect(result).toContain("**Which framework?**: React");

			// Should contain skipped section
			expect(result).toContain("**Questions I chose not to answer:**");
			expect(result).toContain("- Any preferences?");
		});

		test("appends optional comment when provided", () => {
			const now = Date.now();

			const questions: QuestionsTable[] = [
				{
					id: "question_1",
					session_id: "session_1",
					turn_id: "turn_1",
					question_index: 0,
					type: "single_select",
					prompt: "Which option?",
					options_json: JSON.stringify(["A", "B"]),
					answer_json: JSON.stringify("A"),
					status: "answered",
					created_at: now,
					answered_at: now + 1000,
				},
			];

			const result = repos.conversations.formatAnsweredQuestionsMessage(
				questions,
				"Please also consider performance.",
			);

			expect(result).toContain("**Which option?**: A");
			expect(result).toContain("**Additional comments:**");
			expect(result).toContain("Please also consider performance.");
		});

		test("formats array answers as comma-separated values", () => {
			const now = Date.now();

			const questions: QuestionsTable[] = [
				{
					id: "question_1",
					session_id: "session_1",
					turn_id: "turn_1",
					question_index: 0,
					type: "multi_select",
					prompt: "Which languages?",
					options_json: JSON.stringify(["TypeScript", "Python", "Rust"]),
					answer_json: JSON.stringify(["TypeScript", "Rust"]),
					status: "answered",
					created_at: now,
					answered_at: now + 1000,
				},
			];

			const result =
				repos.conversations.formatAnsweredQuestionsMessage(questions);

			expect(result).toContain("**Which languages?**: TypeScript, Rust");
		});
	});

	// =========================================================================
	// Notes
	// =========================================================================

	describe("saveNote", () => {
		test("saves a note and returns its ID", async () => {
			const { workflowId, sessionId } = await createTestSession();

			const noteId = await repos.conversations.saveNote({
				sessionId,
				contextType: "workflow",
				contextId: workflowId,
				content: "Important observation about the codebase.",
			});

			expect(noteId).toMatch(/^note_/);

			const rows = await db
				.selectFrom("session_notes")
				.selectAll()
				.where("id", "=", noteId)
				.execute();

			expect(rows).toHaveLength(1);
			expect(rows[0]?.session_id).toBe(sessionId);
			expect(rows[0]?.context_type).toBe("workflow");
			expect(rows[0]?.context_id).toBe(workflowId);
			expect(rows[0]?.content).toBe(
				"Important observation about the codebase.",
			);
			expect(typeof rows[0]?.created_at).toBe("number");
		});
	});

	describe("getNotes", () => {
		test("returns notes for a context with camelCase mapping", async () => {
			const { workflowId, sessionId } = await createTestSession();

			await repos.conversations.saveNote({
				sessionId,
				contextType: "workflow",
				contextId: workflowId,
				content: "First note",
			});
			await repos.conversations.saveNote({
				sessionId,
				contextType: "workflow",
				contextId: workflowId,
				content: "Second note",
			});

			const notes = await repos.conversations.getNotes("workflow", workflowId);

			expect(notes).toHaveLength(2);
			expect(notes[0]?.content).toBe("First note");
			expect(notes[0]?.id).toMatch(/^note_/);
			expect(typeof notes[0]?.createdAt).toBe("number");
			expect(notes[1]?.content).toBe("Second note");
		});

		test("filters by sessionId when provided", async () => {
			const { workflowId, sessionId } = await createTestSession();

			// Create a second session for the same workflow
			const session2 = await repos.sessions.create({
				contextType: "workflow",
				contextId: workflowId,
				agentRole: "research",
			});

			await repos.conversations.saveNote({
				sessionId,
				contextType: "workflow",
				contextId: workflowId,
				content: "Session 1 note",
			});
			await repos.conversations.saveNote({
				sessionId: session2.id,
				contextType: "workflow",
				contextId: workflowId,
				content: "Session 2 note",
			});

			const session1Notes = await repos.conversations.getNotes(
				"workflow",
				workflowId,
				sessionId,
			);

			expect(session1Notes).toHaveLength(1);
			expect(session1Notes[0]?.content).toBe("Session 1 note");
		});
	});

	// =========================================================================
	// Todos
	// =========================================================================

	describe("getTodos", () => {
		test("returns todos with camelCase mapping ordered by sort_order", async () => {
			const { workflowId, sessionId } = await createTestSession();
			const now = Date.now();

			await db
				.insertInto("session_todos")
				.values({
					id: "todo_1",
					session_id: sessionId,
					context_type: "workflow",
					context_id: workflowId,
					title: "First task",
					description: "Do the first thing",
					checked: 0,
					sort_order: 0,
					created_at: now,
				})
				.execute();
			await db
				.insertInto("session_todos")
				.values({
					id: "todo_2",
					session_id: sessionId,
					context_type: "workflow",
					context_id: workflowId,
					title: "Second task",
					description: "Do the second thing",
					checked: 1,
					sort_order: 1,
					created_at: now + 1,
				})
				.execute();

			const todos = await repos.conversations.getTodos("workflow", workflowId);

			expect(todos).toHaveLength(2);

			// First todo
			expect(todos[0]?.id).toBe("todo_1");
			expect(todos[0]?.title).toBe("First task");
			expect(todos[0]?.description).toBe("Do the first thing");
			expect(todos[0]?.checked).toBe(0);
			expect(todos[0]?.sortOrder).toBe(0);

			// Second todo (checked)
			expect(todos[1]?.id).toBe("todo_2");
			expect(todos[1]?.title).toBe("Second task");
			expect(todos[1]?.description).toBe("Do the second thing");
			expect(todos[1]?.checked).toBe(1);
			expect(todos[1]?.sortOrder).toBe(1);
		});

		test("filters by sessionId when provided", async () => {
			const { workflowId, sessionId } = await createTestSession();
			const now = Date.now();

			// Create a second session
			const session2 = await repos.sessions.create({
				contextType: "workflow",
				contextId: workflowId,
				agentRole: "research",
			});

			await db
				.insertInto("session_todos")
				.values({
					id: "todo_s1",
					session_id: sessionId,
					context_type: "workflow",
					context_id: workflowId,
					title: "Session 1 todo",
					description: "",
					checked: 0,
					sort_order: 0,
					created_at: now,
				})
				.execute();
			await db
				.insertInto("session_todos")
				.values({
					id: "todo_s2",
					session_id: session2.id,
					context_type: "workflow",
					context_id: workflowId,
					title: "Session 2 todo",
					description: "",
					checked: 0,
					sort_order: 0,
					created_at: now + 1,
				})
				.execute();

			const session1Todos = await repos.conversations.getTodos(
				"workflow",
				workflowId,
				sessionId,
			);

			expect(session1Todos).toHaveLength(1);
			expect(session1Todos[0]?.title).toBe("Session 1 todo");
		});
	});

	// =========================================================================
	// Context Loading
	// =========================================================================

	describe("loadSessionContext", () => {
		test("returns completed turns and correct nextTurnIndex", async () => {
			const { sessionId } = await createTestSession();

			// Create 3 turns: 2 completed, 1 streaming
			const turn0 = await repos.conversations.createTurn({
				sessionId,
				turnIndex: 0,
				role: "user",
			});
			await repos.conversations.completeTurn(turn0.id);

			const turn1 = await repos.conversations.createTurn({
				sessionId,
				turnIndex: 1,
				role: "assistant",
			});
			await repos.conversations.completeTurn(turn1.id, {
				tokenCount: 150,
				promptTokens: 75,
				completionTokens: 75,
				modelId: "gpt-4",
			});

			// This turn stays streaming (should not appear)
			await repos.conversations.createTurn({
				sessionId,
				turnIndex: 2,
				role: "user",
			});

			const context = await repos.conversations.loadSessionContext(sessionId);

			expect(context.turns).toHaveLength(2);
			expect(context.turns[0]?.turn_index).toBe(0);
			expect(context.turns[0]?.status).toBe("completed");
			expect(context.turns[1]?.turn_index).toBe(1);
			expect(context.turns[1]?.status).toBe("completed");
			expect(context.nextTurnIndex).toBe(2);
		});

		test("returns nextTurnIndex of 0 when no completed turns exist", async () => {
			const { sessionId } = await createTestSession();

			const context = await repos.conversations.loadSessionContext(sessionId);

			expect(context.turns).toHaveLength(0);
			expect(context.nextTurnIndex).toBe(0);
		});
	});
});
