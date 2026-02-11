/**
 * Tests for ConversationRepository (Part 1)
 *
 * Tests ~15 public methods covering: getHistory, turn lifecycle,
 * message CRUD, and tool tracking.
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
});
