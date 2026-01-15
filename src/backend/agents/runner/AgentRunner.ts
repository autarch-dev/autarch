/**
 * AgentRunner - Executes a single agent session
 *
 * Handles:
 * - Running the LLM with the agent's configuration
 * - Streaming responses to the UI via WebSocket
 * - Executing tool calls (handled by AI SDK)
 * - Persisting turns, messages, tools, and thoughts
 */

import type {
	AssistantModelMessage,
	ModelMessage,
	ToolCallPart,
	ToolModelMessage,
	ToolResultPart,
	UserModelMessage,
} from "@ai-sdk/provider-utils";
import { stepCountIs, streamText } from "ai";
import {
	convertToAISDKTools,
	createChannelToolContext,
	createWorkflowToolContext,
	getModelForScenario,
} from "@/backend/llm";
import type { ToolContext } from "@/backend/tools/types";
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
// Constants
// =============================================================================

/** Maximum number of tool execution steps before stopping */
const MAX_TOOL_STEPS = 15;

// =============================================================================
// AgentRunner
// =============================================================================

export class AgentRunner {
	private session: ActiveSession;
	private config: RunnerConfig;
	private turnIndex = 0;
	private conversationHistory: ModelMessage[] = [];

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
	 * 1. Loads conversation history from DB
	 * 2. Creates a user turn in DB
	 * 3. Streams LLM response using AI SDK
	 * 4. AI SDK handles tool execution automatically via stopWhen
	 * 5. Persists all data and broadcasts events
	 */
	async run(userMessage: string, options: RunOptions = {}): Promise<void> {
		const agentConfig = getAgentConfig(this.session.agentRole);

		// Load existing conversation history for this session
		await this.loadConversationHistory();

		// Create user turn and add to history
		const userTurn = await this.createTurn("user");
		await this.saveMessage(userTurn.id, 0, userMessage);
		await this.completeTurn(userTurn.id);

		// Add user message to history (use simple string content)
		const userMsg: UserModelMessage = {
			role: "user",
			content: userMessage,
		};
		this.conversationHistory.push(userMsg);

		// Create assistant turn
		const assistantTurn = await this.createTurn("assistant");

		try {
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
	// Conversation History
	// ===========================================================================

	/**
	 * Load conversation history from the database for context
	 */
	private async loadConversationHistory(): Promise<void> {
		// Get all completed turns for this session
		const turns = await this.config.db
			.selectFrom("turns")
			.selectAll()
			.where("session_id", "=", this.session.id)
			.where("status", "=", "completed")
			.orderBy("turn_index", "asc")
			.execute();

		// Update turn index to continue from where we left off
		if (turns.length > 0) {
			const lastTurn = turns[turns.length - 1];
			if (lastTurn) {
				this.turnIndex = lastTurn.turn_index + 1;
			}
		}

		// Build conversation history
		for (const turn of turns) {
			// Get messages for this turn
			const messages = await this.config.db
				.selectFrom("turn_messages")
				.selectAll()
				.where("turn_id", "=", turn.id)
				.orderBy("message_index", "asc")
				.execute();

			// Get tool calls for this turn (if assistant)
			const tools = await this.config.db
				.selectFrom("turn_tools")
				.selectAll()
				.where("turn_id", "=", turn.id)
				.orderBy("tool_index", "asc")
				.execute();

			if (turn.role === "user") {
				// User turns are simple text
				const content = messages.map((m) => m.content).join("\n");
				const userMsg: UserModelMessage = {
					role: "user",
					content,
				};
				this.conversationHistory.push(userMsg);
			} else {
				// Assistant turns may have text and tool calls
				const assistantParts: AssistantModelMessage["content"] = [];

				// Add text content
				for (const msg of messages) {
					assistantParts.push({ type: "text", text: msg.content });
				}

				// Add tool calls
				for (const tool of tools) {
					const toolCallPart: ToolCallPart = {
						type: "tool-call",
						toolCallId: tool.id,
						toolName: tool.tool_name,
						input: JSON.parse(tool.input_json),
					};
					assistantParts.push(toolCallPart);
				}

				if (assistantParts.length > 0) {
					const assistantMsg: AssistantModelMessage = {
						role: "assistant",
						content: assistantParts,
					};
					this.conversationHistory.push(assistantMsg);

					// Add tool results as separate messages
					for (const tool of tools) {
						if (tool.output_json) {
							const toolResultPart: ToolResultPart = {
								type: "tool-result",
								toolCallId: tool.id,
								toolName: tool.tool_name,
								output: {
									type: "json",
									value: JSON.parse(tool.output_json),
								},
							};
							const toolMsg: ToolModelMessage = {
								role: "tool",
								content: [toolResultPart],
							};
							this.conversationHistory.push(toolMsg);
						}
					}
				}
			}
		}
	}

	// ===========================================================================
	// LLM Streaming
	// ===========================================================================

	/**
	 * Stream LLM response using Vercel AI SDK
	 *
	 * The AI SDK handles the agentic tool loop automatically via stopWhen.
	 * We process the fullStream to:
	 * - Broadcast text deltas to the UI
	 * - Track and persist tool calls
	 * - Save the complete message
	 */
	private async streamLLMResponse(
		turn: Turn,
		agentConfig: ReturnType<typeof getAgentConfig>,
		options: RunOptions,
	): Promise<void> {
		// Get the model for this agent's scenario
		const model = await getModelForScenario(agentConfig.role);

		// Create tool context based on session type
		const toolContext = this.createToolContext();

		// Convert our tools to AI SDK format
		const tools = convertToAISDKTools(agentConfig.tools, toolContext);

		// Track state during streaming
		let messageBuffer = "";
		let thoughtBuffer = "";
		let toolIndex = 0;
		const activeToolCalls = new Map<string, ToolCall>();

		// Create the abort signal from session + options
		const signal =
			options.signal ?? this.session.abortController?.signal ?? undefined;

		// Start streaming with AI SDK
		const result = streamText({
			model,
			system: agentConfig.systemPrompt,
			messages: this.conversationHistory,
			tools,
			stopWhen: stepCountIs(MAX_TOOL_STEPS),
			abortSignal: signal,
			// Note: maxTokens and temperature are passed via providerOptions or model config
		});

		// Process the stream
		for await (const part of result.fullStream) {
			// Check for abort
			if (signal?.aborted) {
				throw new Error("Aborted");
			}

			switch (part.type) {
				case "text-delta": {
					messageBuffer += part.text;

					// Broadcast delta to UI
					broadcast(
						createTurnMessageDeltaEvent({
							sessionId: this.session.id,
							turnId: turn.id,
							delta: part.text,
						}),
					);

					options.onMessageDelta?.(part.text);
					break;
				}

				case "reasoning-delta": {
					// Extended thinking / reasoning (Claude models)
					thoughtBuffer += part.text;

					broadcast(
						createTurnThoughtDeltaEvent({
							sessionId: this.session.id,
							turnId: turn.id,
							delta: part.text,
						}),
					);

					options.onThoughtDelta?.(part.text);
					break;
				}

				case "tool-call": {
					// Tool call started - get ID from the event
					// The tool-call type has toolCallId from BaseToolCall
					const toolCallId = part.toolCallId;
					const toolCall = await this.recordToolStart(
						turn.id,
						toolIndex++,
						toolCallId,
						part.toolName,
						part.input,
					);

					activeToolCalls.set(toolCallId, toolCall);
					options.onToolStarted?.(toolCall);
					break;
				}

				case "tool-result": {
					// Tool execution completed
					const toolCall = activeToolCalls.get(part.toolCallId);
					if (toolCall) {
						await this.recordToolComplete(
							toolCall,
							part.output,
							true, // AI SDK only emits tool-result on success
						);
						options.onToolCompleted?.(toolCall);
					}
					break;
				}

				case "tool-error": {
					// Tool execution failed
					const toolCall = activeToolCalls.get(part.toolCallId);
					if (toolCall) {
						await this.recordToolComplete(
							toolCall,
							{ error: part.error },
							false,
						);
						options.onToolCompleted?.(toolCall);
					}
					break;
				}

				case "finish-step": {
					// A step completed (may include tool calls)
					// We can track token usage here if needed
					break;
				}

				case "finish": {
					// Stream completed
					break;
				}

				case "error": {
					// Handle streaming error
					throw new Error(
						part.error instanceof Error
							? part.error.message
							: "Stream error occurred",
					);
				}
			}
		}

		// Get final usage stats
		const usage = await result.usage;
		const tokenCount = usage?.totalTokens;

		// Save complete message if we have text content
		if (messageBuffer.length > 0) {
			await this.saveMessage(turn.id, 0, messageBuffer);
		}

		// Save thoughts if we have any
		if (thoughtBuffer.length > 0) {
			await this.saveThought(turn.id, 0, thoughtBuffer);
		}

		// Add assistant response to conversation history for context
		const assistantParts: AssistantModelMessage["content"] = [];

		if (messageBuffer) {
			assistantParts.push({ type: "text", text: messageBuffer });
		}

		for (const toolCall of activeToolCalls.values()) {
			const toolCallPart: ToolCallPart = {
				type: "tool-call",
				toolCallId: toolCall.id,
				toolName: toolCall.toolName,
				input: toolCall.input,
			};
			assistantParts.push(toolCallPart);
		}

		if (assistantParts.length > 0) {
			const assistantMsg: AssistantModelMessage = {
				role: "assistant",
				content: assistantParts,
			};
			this.conversationHistory.push(assistantMsg);
		}

		// Complete the turn with token count
		await this.completeTurn(turn.id, tokenCount);
	}

	// ===========================================================================
	// Tool Context
	// ===========================================================================

	/**
	 * Create the appropriate tool context based on session type
	 */
	private createToolContext(): ToolContext {
		if (this.session.contextType === "channel") {
			return createChannelToolContext(
				this.config.projectRoot,
				this.session.contextId,
				this.session.id,
			);
		}
		return createWorkflowToolContext(
			this.config.projectRoot,
			this.session.contextId,
			this.session.id,
			this.config.worktreePath,
		);
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
	// Tool Tracking
	// ===========================================================================

	/**
	 * Record a tool call starting
	 */
	private async recordToolStart(
		turnId: string,
		toolIndex: number,
		toolCallId: string,
		toolName: string,
		input: unknown,
	): Promise<ToolCall> {
		const now = Date.now();

		// Extract reason from input if present (our tools include a reason param)
		const reason =
			typeof input === "object" &&
			input !== null &&
			"reason" in input &&
			typeof (input as Record<string, unknown>).reason === "string"
				? ((input as Record<string, unknown>).reason as string)
				: null;

		const toolCall: ToolCall = {
			id: toolCallId,
			turnId,
			toolIndex,
			toolName,
			reason: reason ?? undefined,
			input,
			status: "running",
			startedAt: now,
		};

		// Save to DB
		await this.config.db
			.insertInto("turn_tools")
			.values({
				id: toolCallId,
				turn_id: turnId,
				tool_index: toolIndex,
				tool_name: toolName,
				reason,
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
				toolId: toolCallId,
				name: toolName,
				input,
			}),
		);

		return toolCall;
	}

	/**
	 * Record a tool call completing
	 */
	private async recordToolComplete(
		toolCall: ToolCall,
		output: unknown,
		success: boolean,
	): Promise<void> {
		const now = Date.now();

		toolCall.output = output;
		toolCall.status = success ? "completed" : "error";
		toolCall.completedAt = now;

		// Update DB
		await this.config.db
			.updateTable("turn_tools")
			.set({
				output_json: JSON.stringify(output),
				status: toolCall.status,
				completed_at: now,
			})
			.where("id", "=", toolCall.id)
			.execute();

		// Broadcast completion event
		broadcast(
			createTurnToolCompletedEvent({
				sessionId: this.session.id,
				turnId: toolCall.turnId,
				toolId: toolCall.id,
				output,
				success,
			}),
		);
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

function generateThoughtId(): string {
	return `thought_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
