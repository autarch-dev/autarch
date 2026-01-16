/**
 * ConversationRepository - Data access for conversation history
 *
 * Consolidates all the conversation-related database operations including:
 * - Building message history for channels and workflows
 * - Turn management (create, complete, error)
 * - Message segments
 * - Tool call tracking
 * - Thought (extended thinking) persistence
 * - Questions and notes
 */

import type {
	QuestionsTable,
	SessionsTable,
	TurnMessagesTable,
	TurnsTable,
	TurnThoughtsTable,
	TurnToolsTable,
} from "@/backend/db/project/types";
import { ids } from "@/backend/utils";
import type { ChannelMessage, MessageQuestion } from "@/shared/schemas/channel";
import type {
	SessionContextType,
	SessionStatus,
	ToolStatus,
	TurnStatus,
} from "@/shared/schemas/session";
import type { ProjectDb, Repository } from "./types";

// =============================================================================
// Types
// =============================================================================

export interface SessionInfo {
	id: string;
	status: SessionStatus;
	createdAt: number;
}

export interface HistoryResult {
	sessions: SessionInfo[];
	messages: ChannelMessage[];
	activeSessionId?: string;
	activeSessionStatus?: SessionStatus;
}

export interface CreateTurnData {
	sessionId: string;
	turnIndex: number;
	role: "user" | "assistant";
	hidden?: boolean;
}

export interface TurnWithDetails {
	id: string;
	sessionId: string;
	turnIndex: number;
	role: "user" | "assistant";
	status: TurnStatus;
	tokenCount: number | null;
	createdAt: number;
	completedAt: number | null;
}

export interface ToolStartData {
	turnId: string;
	toolIndex: number;
	toolName: string;
	reason: string | null;
	input: unknown;
}

export interface CreateNoteData {
	sessionId: string;
	contextType: SessionContextType;
	contextId: string;
	content: string;
}

// =============================================================================
// Repository
// =============================================================================

export class ConversationRepository implements Repository {
	constructor(readonly db: ProjectDb) {}

	// ===========================================================================
	// History Building (for channels and workflows)
	// ===========================================================================

	/**
	 * Get full conversation history for a channel or workflow.
	 * This is the key method that replaces ~170 lines of duplicated code.
	 */
	async getHistory(
		contextType: SessionContextType,
		contextId: string,
	): Promise<HistoryResult> {
		// Get all sessions for this context
		const sessions = await this.db
			.selectFrom("sessions")
			.selectAll()
			.where("context_type", "=", contextType)
			.where("context_id", "=", contextId)
			.orderBy("created_at", "asc")
			.execute();

		// Find the most recent active session
		const activeSession = sessions.find((s) => s.status === "active");

		// Build messages from all sessions
		const messages: ChannelMessage[] = [];

		for (const session of sessions) {
			const sessionMessages = await this.buildSessionMessages(session.id);
			messages.push(...sessionMessages);
		}

		return {
			sessions: sessions.map((s) => ({
				id: s.id,
				status: s.status,
				createdAt: s.created_at,
			})),
			messages,
			activeSessionId: activeSession?.id,
			activeSessionStatus: activeSession?.status,
		};
	}

	/**
	 * Build messages for a single session
	 */
	private async buildSessionMessages(
		sessionId: string,
	): Promise<ChannelMessage[]> {
		// Get turns for this session (excluding hidden turns like nudges)
		const turns = await this.db
			.selectFrom("turns")
			.selectAll()
			.where("session_id", "=", sessionId)
			.where("hidden", "=", 0)
			.orderBy("turn_index", "asc")
			.execute();

		const messages: ChannelMessage[] = [];

		for (const turn of turns) {
			const message = await this.buildTurnMessage(turn);
			if (message) {
				messages.push(message);
			}
		}

		return messages;
	}

	/**
	 * Build a single ChannelMessage from a turn
	 */
	private async buildTurnMessage(
		turn: TurnsTable,
	): Promise<ChannelMessage | null> {
		// Get messages for this turn
		const turnMessages = await this.db
			.selectFrom("turn_messages")
			.selectAll()
			.where("turn_id", "=", turn.id)
			.orderBy("message_index", "asc")
			.execute();

		// Get tool calls for this turn
		const toolCalls = await this.db
			.selectFrom("turn_tools")
			.selectAll()
			.where("turn_id", "=", turn.id)
			.orderBy("tool_index", "asc")
			.orderBy("started_at", "asc")
			.execute();

		// Get thoughts for this turn
		const thoughts = await this.db
			.selectFrom("turn_thoughts")
			.selectAll()
			.where("turn_id", "=", turn.id)
			.orderBy("thought_index", "asc")
			.execute();

		// Get questions for this turn
		const questions = await this.db
			.selectFrom("questions")
			.selectAll()
			.where("turn_id", "=", turn.id)
			.orderBy("question_index", "asc")
			.execute();

		// Build segments array from turn messages
		const segments = turnMessages.map((m) => ({
			index: m.message_index,
			content: m.content,
		}));

		// Only include turns that have content, tools, or questions
		const hasContent = segments.some((s) => s.content.length > 0);
		if (!hasContent && toolCalls.length === 0 && questions.length === 0) {
			return null;
		}

		return {
			id: turn.id,
			turnId: turn.id,
			role: turn.role as "user" | "assistant",
			segments,
			timestamp: turn.created_at,
			toolCalls:
				toolCalls.length > 0
					? toolCalls.map((tc) => ({
							id: tc.id,
							index: tc.tool_index,
							name: tc.tool_name,
							input: JSON.parse(tc.input_json),
							output: tc.output_json ? JSON.parse(tc.output_json) : undefined,
							status: tc.status as "running" | "completed" | "error",
						}))
					: undefined,
			thought:
				thoughts.length > 0
					? thoughts.map((t) => t.content).join("\n")
					: undefined,
			questions:
				questions.length > 0
					? questions.map((q) => this.toMessageQuestion(q))
					: undefined,
		};
	}

	/**
	 * Convert a question row to MessageQuestion
	 */
	private toMessageQuestion(q: QuestionsTable): MessageQuestion {
		return {
			id: q.id,
			questionIndex: q.question_index,
			type: q.type as "single_select" | "multi_select" | "ranked" | "free_text",
			prompt: q.prompt,
			options: q.options_json ? JSON.parse(q.options_json) : undefined,
			answer: q.answer_json ? JSON.parse(q.answer_json) : undefined,
			status: q.status as "pending" | "answered",
		};
	}

	// ===========================================================================
	// Turn Management
	// ===========================================================================

	/**
	 * Create a new turn
	 */
	async createTurn(data: CreateTurnData): Promise<TurnWithDetails> {
		const now = Date.now();
		const turnId = ids.turn();

		await this.db
			.insertInto("turns")
			.values({
				id: turnId,
				session_id: data.sessionId,
				turn_index: data.turnIndex,
				role: data.role,
				status: "streaming",
				token_count: null,
				hidden: data.hidden ? 1 : 0,
				created_at: now,
				completed_at: null,
			})
			.execute();

		return {
			id: turnId,
			sessionId: data.sessionId,
			turnIndex: data.turnIndex,
			role: data.role,
			status: "streaming",
			tokenCount: null,
			createdAt: now,
			completedAt: null,
		};
	}

	/**
	 * Mark a turn as completed
	 */
	async completeTurn(turnId: string, tokenCount?: number): Promise<void> {
		await this.db
			.updateTable("turns")
			.set({
				status: "completed",
				token_count: tokenCount ?? null,
				completed_at: Date.now(),
			})
			.where("id", "=", turnId)
			.execute();
	}

	/**
	 * Mark a turn as errored
	 */
	async errorTurn(turnId: string): Promise<void> {
		await this.db
			.updateTable("turns")
			.set({
				status: "error",
				completed_at: Date.now(),
			})
			.where("id", "=", turnId)
			.execute();
	}

	/**
	 * Get all completed turns for a session (used for context loading)
	 */
	async getCompletedTurns(sessionId: string): Promise<TurnsTable[]> {
		return this.db
			.selectFrom("turns")
			.selectAll()
			.where("session_id", "=", sessionId)
			.where("status", "=", "completed")
			.orderBy("turn_index", "asc")
			.execute();
	}

	// ===========================================================================
	// Message Segments
	// ===========================================================================

	/**
	 * Save a message segment for a turn
	 */
	async saveMessage(
		turnId: string,
		index: number,
		content: string,
	): Promise<void> {
		const messageId = ids.message();

		await this.db
			.insertInto("turn_messages")
			.values({
				id: messageId,
				turn_id: turnId,
				message_index: index,
				content,
				created_at: Date.now(),
			})
			.execute();
	}

	/**
	 * Update an existing message segment
	 */
	async updateMessage(
		turnId: string,
		index: number,
		content: string,
	): Promise<void> {
		await this.db
			.updateTable("turn_messages")
			.set({ content })
			.where("turn_id", "=", turnId)
			.where("message_index", "=", index)
			.execute();
	}

	/**
	 * Save or update a message segment
	 */
	async upsertMessage(
		turnId: string,
		index: number,
		content: string,
	): Promise<void> {
		const existing = await this.db
			.selectFrom("turn_messages")
			.select("id")
			.where("turn_id", "=", turnId)
			.where("message_index", "=", index)
			.executeTakeFirst();

		if (existing) {
			await this.updateMessage(turnId, index, content);
		} else {
			await this.saveMessage(turnId, index, content);
		}
	}

	/**
	 * Get messages for a turn
	 */
	async getMessages(turnId: string): Promise<TurnMessagesTable[]> {
		return this.db
			.selectFrom("turn_messages")
			.selectAll()
			.where("turn_id", "=", turnId)
			.orderBy("message_index", "asc")
			.execute();
	}

	// ===========================================================================
	// Tool Tracking
	// ===========================================================================

	/**
	 * Record the start of a tool call
	 */
	async recordToolStart(data: ToolStartData): Promise<string> {
		const toolId = data.toolName; // Use tool name as ID for AI SDK compatibility

		await this.db
			.insertInto("turn_tools")
			.values({
				id: toolId,
				turn_id: data.turnId,
				tool_index: data.toolIndex,
				tool_name: data.toolName,
				reason: data.reason,
				input_json: JSON.stringify(data.input),
				output_json: null,
				status: "running",
				started_at: Date.now(),
				completed_at: null,
			})
			.execute();

		return toolId;
	}

	/**
	 * Record tool completion
	 */
	async recordToolComplete(
		toolId: string,
		output: unknown,
		success: boolean,
	): Promise<void> {
		await this.db
			.updateTable("turn_tools")
			.set({
				output_json: JSON.stringify(output),
				status: success ? "completed" : "error",
				completed_at: Date.now(),
			})
			.where("id", "=", toolId)
			.execute();
	}

	/**
	 * Get tools for a turn
	 */
	async getTools(turnId: string): Promise<TurnToolsTable[]> {
		return this.db
			.selectFrom("turn_tools")
			.selectAll()
			.where("turn_id", "=", turnId)
			.orderBy("tool_index", "asc")
			.orderBy("started_at", "asc")
			.execute();
	}

	// ===========================================================================
	// Thoughts (Extended Thinking)
	// ===========================================================================

	/**
	 * Save a thought for a turn
	 */
	async saveThought(
		turnId: string,
		index: number,
		content: string,
	): Promise<void> {
		const thoughtId = ids.thought();

		await this.db
			.insertInto("turn_thoughts")
			.values({
				id: thoughtId,
				turn_id: turnId,
				thought_index: index,
				content,
				created_at: Date.now(),
			})
			.execute();
	}

	/**
	 * Update an existing thought
	 */
	async updateThought(
		turnId: string,
		index: number,
		content: string,
	): Promise<void> {
		await this.db
			.updateTable("turn_thoughts")
			.set({ content })
			.where("turn_id", "=", turnId)
			.where("thought_index", "=", index)
			.execute();
	}

	/**
	 * Save or update a thought
	 */
	async upsertThought(
		turnId: string,
		index: number,
		content: string,
	): Promise<void> {
		const existing = await this.db
			.selectFrom("turn_thoughts")
			.select("id")
			.where("turn_id", "=", turnId)
			.where("thought_index", "=", index)
			.executeTakeFirst();

		if (existing) {
			await this.updateThought(turnId, index, content);
		} else {
			await this.saveThought(turnId, index, content);
		}
	}

	// ===========================================================================
	// Questions
	// ===========================================================================

	/**
	 * Get questions for a turn
	 */
	async getQuestionsByTurn(turnId: string): Promise<QuestionsTable[]> {
		return this.db
			.selectFrom("questions")
			.selectAll()
			.where("turn_id", "=", turnId)
			.orderBy("question_index", "asc")
			.execute();
	}

	/**
	 * Get unanswered questions for a session
	 */
	async getPendingQuestions(sessionId: string): Promise<QuestionsTable[]> {
		return this.db
			.selectFrom("questions")
			.selectAll()
			.where("session_id", "=", sessionId)
			.where("status", "=", "pending")
			.orderBy("created_at", "asc")
			.execute();
	}

	/**
	 * Answer a question
	 */
	async answerQuestion(questionId: string, answer: unknown): Promise<void> {
		await this.db
			.updateTable("questions")
			.set({
				answer_json: JSON.stringify(answer),
				status: "answered",
				answered_at: Date.now(),
			})
			.where("id", "=", questionId)
			.execute();
	}

	// ===========================================================================
	// Notes
	// ===========================================================================

	/**
	 * Get notes for a context
	 */
	async getNotes(
		contextType: SessionContextType,
		contextId: string,
		sessionId?: string,
	): Promise<{ id: string; content: string; createdAt: number }[]> {
		let query = this.db
			.selectFrom("session_notes")
			.select(["id", "content", "created_at"])
			.where("context_type", "=", contextType)
			.where("context_id", "=", contextId);

		if (sessionId) {
			query = query.where("session_id", "=", sessionId);
		}

		const notes = await query.orderBy("created_at", "asc").execute();

		return notes.map((n) => ({
			id: n.id,
			content: n.content,
			createdAt: n.created_at,
		}));
	}

	/**
	 * Save a note
	 */
	async saveNote(data: CreateNoteData): Promise<string> {
		const noteId = ids.note();

		await this.db
			.insertInto("session_notes")
			.values({
				id: noteId,
				session_id: data.sessionId,
				context_type: data.contextType,
				context_id: data.contextId,
				content: data.content,
				created_at: Date.now(),
			})
			.execute();

		return noteId;
	}

	// ===========================================================================
	// Context Loading for AgentRunner
	// ===========================================================================

	/**
	 * Load conversation context for an agent session.
	 * Returns completed turns and determines next turn index.
	 */
	async loadSessionContext(sessionId: string): Promise<{
		turns: TurnsTable[];
		nextTurnIndex: number;
	}> {
		const turns = await this.getCompletedTurns(sessionId);

		const nextTurnIndex =
			turns.length > 0 ? (turns[turns.length - 1]?.turn_index ?? 0) + 1 : 0;

		return { turns, nextTurnIndex };
	}
}
