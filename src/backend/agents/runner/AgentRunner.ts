/**
 * AgentRunner - Executes a single agent session
 *
 * Handles:
 * - Running the LLM with the agent's configuration
 * - Streaming responses to the UI
 * - Executing tool calls
 * - Persisting turns, messages, tools, and thoughts
 */

import type { Kysely } from "kysely";
import type { ProjectDatabase } from "@/backend/db/project";
import { broadcast } from "@/backend/ws";
import {
	createTurnCompletedEvent,
	createTurnMessageDeltaEvent,
	createTurnStartedEvent,
	createTurnThoughtDeltaEvent,
	createTurnToolCompletedEvent,
	createTurnToolStartedEvent,
} from "@/shared/schemas/events";
import { getAgentConfig } from "../registry";
import type {
	ActiveSession,
	RunnerConfig,
	RunOptions,
	ToolCall,
	Turn,
} from "./types";

// =============================================================================
// AgentRunner
// =============================================================================

export class AgentRunner {
	private session: ActiveSession;
	private config: RunnerConfig;
	private turnIndex = 0;

	constructor(session: ActiveSession, config: RunnerConfig) {
		this.session = session;
		this.config = config;
	}

	// ===========================================================================
	// Main Execution
	// ===========================================================================

	/**
	 * Run the agent with a user message
	 *
	 * This is the main entry point for agent execution:
	 * 1. Creates a user turn in DB
	 * 2. Streams LLM response
	 * 3. Handles tool calls (agentic loop)
	 * 4. Persists all data
	 * 5. Broadcasts events
	 */
	async run(userMessage: string, options: RunOptions = {}): Promise<void> {
		const agentConfig = getAgentConfig(this.session.agentRole);

		// Create user turn
		const userTurn = await this.createTurn("user");
		await this.saveMessage(userTurn.id, 0, userMessage);
		await this.completeTurn(userTurn.id);

		// Create assistant turn
		const assistantTurn = await this.createTurn("assistant");

		try {
			// TODO: Implement actual LLM streaming
			// This is a stub that will be replaced with actual LLM integration
			await this.streamLLMResponse(assistantTurn, agentConfig, options);

			await this.completeTurn(assistantTurn.id);
		} catch (error) {
			await this.errorTurn(
				assistantTurn.id,
				error instanceof Error ? error.message : "Unknown error",
			);
			throw error;
		}
	}

	// ===========================================================================
	// LLM Streaming (Stub)
	// ===========================================================================

	/**
	 * Stream LLM response and handle tool calls
	 *
	 * TODO: Implement actual LLM integration with:
	 * - Anthropic SDK for Claude models
	 * - OpenAI SDK for GPT models
	 * - Google AI SDK for Gemini models
	 * - xAI SDK for Grok models
	 */
	private async streamLLMResponse(
		turn: Turn,
		_agentConfig: ReturnType<typeof getAgentConfig>,
		options: RunOptions,
	): Promise<void> {
		// Stub implementation - simulates streaming
		const stubMessage =
			"[Agent response stub] This is where the LLM response will be streamed.";

		const messageIndex = 0;
		const messageBuffer: string[] = [];

		// Simulate streaming chunks
		for (const char of stubMessage) {
			if (options.signal?.aborted) {
				throw new Error("Aborted");
			}

			messageBuffer.push(char);

			// Emit delta
			broadcast(
				createTurnMessageDeltaEvent({
					sessionId: this.session.id,
					turnId: turn.id,
					delta: char,
				}),
			);

			options.onMessageDelta?.(char);

			// Small delay to simulate streaming
			await sleep(10);
		}

		// Save complete message
		await this.saveMessage(turn.id, messageIndex, messageBuffer.join(""));

		// TODO: Handle tool calls in agentic loop
		// When the LLM requests a tool call:
		// 1. Parse the tool call from the response
		// 2. Execute the tool
		// 3. Send tool result back to LLM
		// 4. Continue streaming until complete
	}

	// ===========================================================================
	// Turn Management
	// ===========================================================================

	private async createTurn(role: "user" | "assistant"): Promise<Turn> {
		const now = Date.now();
		const turnId = generateTurnId();
		const index = this.turnIndex++;

		await this.config.db
			.insertInto("turns")
			.values({
				id: turnId,
				session_id: this.session.id,
				turn_index: index,
				role,
				status: "streaming",
				token_count: null,
				created_at: now,
				completed_at: null,
			})
			.execute();

		const turn: Turn = {
			id: turnId,
			sessionId: this.session.id,
			turnIndex: index,
			role,
			status: "streaming",
			createdAt: now,
		};

		broadcast(
			createTurnStartedEvent({
				sessionId: this.session.id,
				turnId,
				role,
			}),
		);

		return turn;
	}

	private async completeTurn(
		turnId: string,
		tokenCount?: number,
	): Promise<void> {
		const now = Date.now();

		await this.config.db
			.updateTable("turns")
			.set({
				status: "completed",
				token_count: tokenCount ?? null,
				completed_at: now,
			})
			.where("id", "=", turnId)
			.execute();

		broadcast(
			createTurnCompletedEvent({
				sessionId: this.session.id,
				turnId,
				tokenCount,
			}),
		);
	}

	private async errorTurn(turnId: string, _error: string): Promise<void> {
		const now = Date.now();

		await this.config.db
			.updateTable("turns")
			.set({
				status: "error",
				completed_at: now,
			})
			.where("id", "=", turnId)
			.execute();
	}

	// ===========================================================================
	// Message Management
	// ===========================================================================

	private async saveMessage(
		turnId: string,
		messageIndex: number,
		content: string,
	): Promise<void> {
		const now = Date.now();
		const messageId = generateMessageId();

		await this.config.db
			.insertInto("turn_messages")
			.values({
				id: messageId,
				turn_id: turnId,
				message_index: messageIndex,
				content,
				created_at: now,
			})
			.execute();
	}

	// ===========================================================================
	// Tool Execution (Stub)
	// ===========================================================================

	/**
	 * Execute a tool call
	 *
	 * TODO: Implement actual tool execution:
	 * 1. Validate tool name is available to this agent
	 * 2. Parse and validate input against tool schema
	 * 3. Execute the tool
	 * 4. Handle errors gracefully
	 * 5. Notify orchestrator if it's a stage-completion tool
	 */
	private async executeTool(
		turnId: string,
		toolIndex: number,
		toolName: string,
		input: unknown,
		options: RunOptions,
	): Promise<ToolCall> {
		const now = Date.now();
		const toolId = generateToolId();

		const toolCall: ToolCall = {
			id: toolId,
			turnId,
			toolIndex,
			toolName,
			input,
			status: "running",
			startedAt: now,
		};

		// Save to DB
		await this.config.db
			.insertInto("turn_tools")
			.values({
				id: toolId,
				turn_id: turnId,
				tool_index: toolIndex,
				tool_name: toolName,
				reason: null, // TODO: Extract from input
				input_json: JSON.stringify(input),
				output_json: null,
				status: "running",
				started_at: now,
				completed_at: null,
			})
			.execute();

		// Broadcast start event
		broadcast(
			createTurnToolStartedEvent({
				sessionId: this.session.id,
				turnId,
				toolId,
				name: toolName,
				input,
			}),
		);

		options.onToolStarted?.(toolCall);

		try {
			// TODO: Actually execute the tool
			const output = { stub: true, message: "Tool execution not implemented" };

			toolCall.output = output;
			toolCall.status = "completed";
			toolCall.completedAt = Date.now();

			// Update DB
			await this.config.db
				.updateTable("turn_tools")
				.set({
					output_json: JSON.stringify(output),
					status: "completed",
					completed_at: toolCall.completedAt,
				})
				.where("id", "=", toolId)
				.execute();

			// Broadcast completion event
			broadcast(
				createTurnToolCompletedEvent({
					sessionId: this.session.id,
					turnId,
					toolId,
					output,
					success: true,
				}),
			);

			options.onToolCompleted?.(toolCall);

			return toolCall;
		} catch (error) {
			toolCall.status = "error";
			toolCall.completedAt = Date.now();

			const errorOutput = {
				error: error instanceof Error ? error.message : "Unknown error",
			};

			await this.config.db
				.updateTable("turn_tools")
				.set({
					output_json: JSON.stringify(errorOutput),
					status: "error",
					completed_at: toolCall.completedAt,
				})
				.where("id", "=", toolId)
				.execute();

			broadcast(
				createTurnToolCompletedEvent({
					sessionId: this.session.id,
					turnId,
					toolId,
					output: errorOutput,
					success: false,
				}),
			);

			options.onToolCompleted?.(toolCall);

			throw error;
		}
	}

	// ===========================================================================
	// Thought Management (Extended Thinking)
	// ===========================================================================

	/**
	 * Save a thought block from extended thinking
	 */
	private async saveThought(
		turnId: string,
		thoughtIndex: number,
		content: string,
	): Promise<void> {
		const now = Date.now();
		const thoughtId = generateThoughtId();

		await this.config.db
			.insertInto("turn_thoughts")
			.values({
				id: thoughtId,
				turn_id: turnId,
				thought_index: thoughtIndex,
				content,
				created_at: now,
			})
			.execute();
	}
}

// =============================================================================
// Helpers
// =============================================================================

function generateTurnId(): string {
	return `turn_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function generateMessageId(): string {
	return `msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function generateToolId(): string {
	return `tool_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function generateThoughtId(): string {
	return `thought_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
