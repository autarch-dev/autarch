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
 *
 * All JSON fields are validated on read/write using Zod schemas.
 */

import {
	parseJson,
	parseJsonOptional,
	QuestionAnswerJsonSchema,
	QuestionOptionsJsonSchema,
	stringifyJson,
	ToolInputJsonSchema,
	ToolOutputJsonSchema,
} from "@/backend/db/project/json-schemas";
import type {
	QuestionsTable,
	TurnMessagesTable,
	TurnsTable,
	TurnToolsTable,
} from "@/backend/db/project/types";
import { getCostCalculator } from "@/backend/services/cost";
import { ids } from "@/backend/utils";
import type { ChannelMessage, MessageQuestion } from "@/shared/schemas/channel";
import type {
	SessionContextType,
	SessionStatus,
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
	promptTokens: number | null;
	completionTokens: number | null;
	modelId: string | null;
	createdAt: number;
	completedAt: number | null;
}

export interface ToolStartData {
	/** Optional explicit ID (from AI SDK's toolCallId). If not provided, uses toolName. */
	id?: string;
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
	 * Build a single ChannelMessage from a turn.
	 * All JSON fields are validated against their schemas.
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

		// Calculate cost for assistant turns
		let cost: number | undefined;
		if (
			turn.role === "assistant" &&
			turn.model_id &&
			turn.prompt_tokens != null &&
			turn.completion_tokens != null
		) {
			cost = getCostCalculator().calculate(
				turn.model_id,
				turn.prompt_tokens,
				turn.completion_tokens,
			);
		}

		return {
			id: turn.id,
			turnId: turn.id,
			role: turn.role as "user" | "assistant",
			segments,
			timestamp: turn.created_at,
			toolCalls:
				toolCalls.length > 0
					? toolCalls.map((tc) => this.toToolCall(tc))
					: undefined,
			thought:
				thoughts.length > 0
					? thoughts.map((t) => t.content).join("\n")
					: undefined,
			questions:
				questions.length > 0
					? questions.map((q) => this.toMessageQuestion(q))
					: undefined,
			cost,
		};
	}

	/**
	 * Convert a tool row to a typed tool call object.
	 * JSON fields are validated against their schemas.
	 */
	private toToolCall(tc: TurnToolsTable): {
		id: string;
		index: number;
		name: string;
		input: unknown;
		output: unknown | undefined;
		status: "running" | "completed" | "error";
	} {
		return {
			id: tc.id,
			index: tc.tool_index,
			name: tc.tool_name,
			input: parseJson(
				tc.input_json,
				ToolInputJsonSchema,
				`tool[${tc.id}].input_json`,
			),
			output: parseJsonOptional(
				tc.output_json,
				ToolOutputJsonSchema,
				`tool[${tc.id}].output_json`,
			),
			status: tc.status as "running" | "completed" | "error",
		};
	}

	/**
	 * Convert a question row to MessageQuestion.
	 * JSON fields are validated against their schemas.
	 */
	private toMessageQuestion(q: QuestionsTable): MessageQuestion {
		return {
			id: q.id,
			questionIndex: q.question_index,
			type: q.type as "single_select" | "multi_select" | "ranked" | "free_text",
			prompt: q.prompt,
			options: parseJsonOptional(
				q.options_json,
				QuestionOptionsJsonSchema,
				`question[${q.id}].options_json`,
			),
			answer: parseJsonOptional(
				q.answer_json,
				QuestionAnswerJsonSchema,
				`question[${q.id}].answer_json`,
			),
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
				prompt_tokens: null,
				completion_tokens: null,
				model_id: null,
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
			promptTokens: null,
			completionTokens: null,
			modelId: null,
			createdAt: now,
			completedAt: null,
		};
	}

	/**
	 * Mark a turn as completed with token usage data
	 */
	async completeTurn(
		turnId: string,
		usage?: {
			tokenCount?: number;
			promptTokens?: number;
			completionTokens?: number;
			modelId?: string;
		},
	): Promise<void> {
		await this.db
			.updateTable("turns")
			.set({
				status: "completed",
				token_count: usage?.tokenCount ?? null,
				prompt_tokens: usage?.promptTokens ?? null,
				completion_tokens: usage?.completionTokens ?? null,
				model_id: usage?.modelId ?? null,
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
	 * Record the start of a tool call.
	 * Input is validated before serialization.
	 *
	 * @param data.id - Explicit ID to use (e.g., from AI SDK's toolCallId). Falls back to toolName.
	 */
	async recordToolStart(data: ToolStartData): Promise<string> {
		// Use provided ID or fall back to tool name
		const toolId = data.id ?? data.toolName;

		await this.db
			.insertInto("turn_tools")
			.values({
				id: toolId,
				turn_id: data.turnId,
				tool_index: data.toolIndex,
				tool_name: data.toolName,
				reason: data.reason,
				input_json: stringifyJson(
					data.input,
					ToolInputJsonSchema,
					`tool[${toolId}].input_json`,
				),
				output_json: null,
				status: "running",
				started_at: Date.now(),
				completed_at: null,
			})
			.execute();

		return toolId;
	}

	/**
	 * Record tool completion.
	 * Output is validated before serialization.
	 */
	async recordToolComplete(
		toolId: string,
		output: unknown,
		success: boolean,
	): Promise<void> {
		await this.db
			.updateTable("turn_tools")
			.set({
				output_json: stringifyJson(
					output,
					ToolOutputJsonSchema,
					`tool[${toolId}].output_json`,
				),
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

	/**
	 * Get tool names for a turn (lightweight query for checking terminal tools)
	 */
	async getToolNames(turnId: string): Promise<string[]> {
		const tools = await this.db
			.selectFrom("turn_tools")
			.select("tool_name")
			.where("turn_id", "=", turnId)
			.execute();
		return tools.map((t) => t.tool_name);
	}

	/**
	 * Get successfully completed tool names for a turn.
	 * Only returns tools with status="completed" (not "error").
	 * Used to determine if auto-transition tools actually succeeded.
	 */
	async getSucceededToolNames(turnId: string): Promise<string[]> {
		const tools = await this.db
			.selectFrom("turn_tools")
			.select("tool_name")
			.where("turn_id", "=", turnId)
			.where("status", "=", "completed")
			.execute();
		return tools.map((t) => t.tool_name);
	}

	/**
	 * Parse tool input JSON with validation.
	 * Returns the parsed input or undefined if null/invalid.
	 */
	parseToolInput(tool: TurnToolsTable): unknown {
		return parseJson(
			tool.input_json,
			ToolInputJsonSchema,
			`tool[${tool.id}].input_json`,
		);
	}

	/**
	 * Parse tool output JSON with validation.
	 * Returns the parsed output or undefined if null.
	 */
	parseToolOutput(tool: TurnToolsTable): unknown | undefined {
		return parseJsonOptional(
			tool.output_json,
			ToolOutputJsonSchema,
			`tool[${tool.id}].output_json`,
		);
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
	 * Get a question by ID
	 */
	async getQuestionById(questionId: string): Promise<QuestionsTable | null> {
		const question = await this.db
			.selectFrom("questions")
			.selectAll()
			.where("id", "=", questionId)
			.executeTakeFirst();
		return question ?? null;
	}

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
	 * Get pending questions for a turn
	 */
	async getPendingQuestionsByTurn(turnId: string): Promise<QuestionsTable[]> {
		return this.db
			.selectFrom("questions")
			.selectAll()
			.where("turn_id", "=", turnId)
			.where("status", "=", "pending")
			.orderBy("question_index", "asc")
			.execute();
	}

	/**
	 * Answer a question.
	 * Answer is validated before serialization.
	 */
	async answerQuestion(questionId: string, answer: unknown): Promise<void> {
		await this.db
			.updateTable("questions")
			.set({
				answer_json: stringifyJson(
					answer,
					QuestionAnswerJsonSchema,
					`question[${questionId}].answer_json`,
				),
				status: "answered",
				answered_at: Date.now(),
			})
			.where("id", "=", questionId)
			.execute();
	}

	/**
	 * Mark remaining pending questions for a turn as skipped
	 */
	async skipPendingQuestions(turnId: string): Promise<number> {
		const result = await this.db
			.updateTable("questions")
			.set({ status: "skipped" })
			.where("turn_id", "=", turnId)
			.where("status", "=", "pending")
			.execute();
		return Number(result[0]?.numUpdatedRows ?? 0);
	}

	/**
	 * Parse and return the answer from a question row.
	 * Uses safe JSON parsing with schema validation.
	 */
	parseQuestionAnswer(question: QuestionsTable): unknown | undefined {
		return parseJsonOptional(
			question.answer_json,
			QuestionAnswerJsonSchema,
			`question[${question.id}].answer_json`,
		);
	}

	/**
	 * Format answered questions as a user message string.
	 * Helper for resuming agents after questions are answered.
	 */
	formatAnsweredQuestionsMessage(
		questions: QuestionsTable[],
		comment?: string,
	): string {
		const messageParts: string[] = [];

		// Add answered questions
		const answeredQuestions = questions.filter((q) => q.status === "answered");
		if (answeredQuestions.length > 0) {
			const answerLines = answeredQuestions.map((q) => {
				const answer = this.parseQuestionAnswer(q);
				const formattedAnswer = Array.isArray(answer)
					? answer.join(", ")
					: String(answer ?? "");
				return `**${q.prompt}**: ${formattedAnswer}`;
			});
			messageParts.push(answerLines.join("\n\n"));
		}

		// Note skipped questions
		const skippedQuestions = questions.filter((q) => q.status === "skipped");
		if (skippedQuestions.length > 0) {
			const skippedList = skippedQuestions
				.map((q) => `- ${q.prompt}`)
				.join("\n");
			messageParts.push(`**Questions I chose not to answer:**\n${skippedList}`);
		}

		// Add user comment if provided
		if (comment) {
			messageParts.push(`**Additional comments:**\n${comment}`);
		}

		return messageParts.join("\n\n---\n\n");
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
