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
	SystemModelMessage,
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

		// Inject notes as a system message just before the user message
		const notesMessage = await this.buildNotesSystemMessage();
		if (notesMessage) {
			this.conversationHistory.push(notesMessage);
		}

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

	/** Number of recent tools to include with full details */
	private static readonly RECENT_TOOLS_LIMIT = 5;

	/**
	 * Load conversation history from the database for context.
	 *
	 * To manage context size, only the last N tools are included with full
	 * call/result details. Older tools are summarized in a system message.
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

		// First pass: collect all tools to determine which are "recent"
		const allTools: Array<{
			id: string;
			turnId: string;
			toolName: string;
			reason: string | null;
			inputJson: string;
			outputJson: string | null;
		}> = [];

		for (const turn of turns) {
			if (turn.role === "assistant") {
				const tools = await this.config.db
					.selectFrom("turn_tools")
					.selectAll()
					.where("turn_id", "=", turn.id)
					.orderBy("tool_index", "asc")
					.execute();

				for (const tool of tools) {
					allTools.push({
						id: tool.id,
						turnId: turn.id,
						toolName: tool.tool_name,
						reason: tool.reason,
						inputJson: tool.input_json,
						outputJson: tool.output_json,
					});
				}
			}
		}

		// Determine which tools are "recent" (last N)
		const recentToolIds = new Set(
			allTools.slice(-AgentRunner.RECENT_TOOLS_LIMIT).map((t) => t.id),
		);

		// Build summaries for older tools (grouped by turn for context)
		const olderTools = allTools.filter((t) => !recentToolIds.has(t.id));
		const olderToolSummaries = this.buildToolSummaries(olderTools);

		// Inject older tool summaries at the start of history (if any)
		if (olderToolSummaries) {
			const summaryMsg: SystemModelMessage = {
				role: "system",
				content: olderToolSummaries,
			};
			this.conversationHistory.push(summaryMsg);
		}

		// Second pass: build conversation history
		for (const turn of turns) {
			// Get messages for this turn
			const messages = await this.config.db
				.selectFrom("turn_messages")
				.selectAll()
				.where("turn_id", "=", turn.id)
				.orderBy("message_index", "asc")
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
				// Get tools for this turn, filtering to only recent ones
				const turnTools = allTools.filter(
					(t) => t.turnId === turn.id && recentToolIds.has(t.id),
				);

				// Assistant turns may have text and tool calls
				const assistantParts: AssistantModelMessage["content"] = [];

				// Add text content
				for (const msg of messages) {
					assistantParts.push({ type: "text", text: msg.content });
				}

				// Add only recent tool calls
				for (const tool of turnTools) {
					const toolCallPart: ToolCallPart = {
						type: "tool-call",
						toolCallId: tool.id,
						toolName: tool.toolName,
						input: JSON.parse(tool.inputJson),
					};
					assistantParts.push(toolCallPart);
				}

				if (assistantParts.length > 0) {
					const assistantMsg: AssistantModelMessage = {
						role: "assistant",
						content: assistantParts,
					};
					this.conversationHistory.push(assistantMsg);

					// Add tool results only for recent tools
					for (const tool of turnTools) {
						if (tool.outputJson) {
							const toolResultPart: ToolResultPart = {
								type: "tool-result",
								toolCallId: tool.id,
								toolName: tool.toolName,
								output: {
									type: "json",
									value: JSON.parse(tool.outputJson),
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

	/**
	 * Build a summary of older tool calls for context preservation.
	 */
	private buildToolSummaries(
		tools: Array<{
			toolName: string;
			reason: string | null;
			inputJson: string;
		}>,
	): string | null {
		if (tools.length === 0) {
			return null;
		}

		const summaries = tools.map((tool) => {
			const input = JSON.parse(tool.inputJson);
			// Summarize input args - just show keys or truncated values
			const inputSummary = this.summarizeToolInput(input);
			const reasonPart = tool.reason ? ` for reason: "${tool.reason}"` : "";
			return `- You ran \`${tool.toolName}\` with input ${inputSummary}${reasonPart}`;
		});

		return `## Previous Tool Usage\n\nEarlier in this conversation, you executed the following tools (results omitted for brevity):\n\n${summaries.join("\n")}`;
	}

	/**
	 * Summarize tool input for the tool history summary.
	 * Shows key-value pairs, truncating long values.
	 */
	private summarizeToolInput(input: unknown): string {
		if (typeof input !== "object" || input === null) {
			return JSON.stringify(input);
		}

		const entries = Object.entries(input as Record<string, unknown>);
		if (entries.length === 0) {
			return "{}";
		}

		const summarized = entries.map(([key, value]) => {
			let valueStr: string;
			if (typeof value === "string") {
				// Truncate long strings
				valueStr =
					value.length > 50 ? `"${value.slice(0, 50)}..."` : `"${value}"`;
			} else if (typeof value === "object") {
				valueStr = Array.isArray(value) ? `[${value.length} items]` : "{...}";
			} else {
				valueStr = JSON.stringify(value);
			}
			return `${key}: ${valueStr}`;
		});

		return `{ ${summarized.join(", ")} }`;
	}

	/**
	 * Build a system message containing notes for the current context.
	 *
	 * Notes have different scoping based on context:
	 * - Channels: Notes persist across the entire channel lifetime (query by context_id)
	 * - Workflows: Notes are ephemeral per stage (query by session_id)
	 */
	private async buildNotesSystemMessage(): Promise<SystemModelMessage | null> {
		let notes: Array<{ content: string; created_at: number }>;

		if (this.session.contextType === "channel") {
			// For channels: notes persist across channel lifetime
			notes = await this.config.db
				.selectFrom("session_notes")
				.select(["content", "created_at"])
				.where("context_type", "=", "channel")
				.where("context_id", "=", this.session.contextId)
				.orderBy("created_at", "asc")
				.execute();
		} else {
			// For workflows: notes are ephemeral per stage (session)
			notes = await this.config.db
				.selectFrom("session_notes")
				.select(["content", "created_at"])
				.where("session_id", "=", this.session.id)
				.orderBy("created_at", "asc")
				.execute();
		}

		if (notes.length === 0) {
			return null;
		}

		// Format notes as a system message
		const formattedNotes = notes
			.map((note, index) => `[Note ${index + 1}] ${note.content}`)
			.join("\n\n");

		return {
			role: "system",
			content: `## Your Notes\n\nYou have saved the following notes for yourself:\n\n${formattedNotes}`,
		};
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
