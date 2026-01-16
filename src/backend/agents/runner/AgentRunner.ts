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
import { log } from "@/backend/logger";
import type { ToolContext } from "@/backend/tools/types";
import { ids } from "@/backend/utils";
import { broadcast } from "@/backend/ws";
import {
	createTurnCompletedEvent,
	createTurnMessageDeltaEvent,
	createTurnSegmentCompleteEvent,
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

/** Maximum number of nudges per user message */
const MAX_NUDGES = 2;

/**
 * Terminal tools by agent role - these tools signal a valid turn ending.
 * If an agent completes a turn without calling one of these, it gets nudged.
 */
const TERMINAL_TOOLS: Record<string, string[]> = {
	scoping: ["submit_scope", "ask_questions"],
	research: ["submit_research", "request_extension", "ask_questions"],
	planning: ["submit_plan", "ask_questions"],
	execution: ["complete_pulse", "request_extension"],
	// discussion and review agents don't require terminal tools
	discussion: [],
	review: [],
	basic: [],
};

/**
 * Nudge messages by agent role - sent when agent doesn't use a terminal tool
 */
const NUDGE_MESSAGES: Record<string, string> = {
	scoping: `You did not end your turn with a required tool call.

As a reminder, every message MUST end with exactly one of:
- \`submit_scope\` — if you have enough information to define the scope
- \`ask_questions\` — if you need clarification from the user

Please continue and ensure your next response ends with one of these tools.`,

	research: `You did not end your turn with a required tool call.

As a reminder, every message MUST end with exactly one of:
- \`submit_research\` — if you have sufficient understanding to guide implementation
- \`request_extension\` — if any investigation remains
- \`ask_questions\` — if user input is required to resolve ambiguity

Please continue and ensure your next response ends with one of these tools.`,

	planning: `You did not end your turn with a required tool call.

As a reminder, every message MUST end with exactly one of:
- \`submit_plan\` — if you have a complete implementation plan
- \`ask_questions\` — if you need clarification from the user

Please continue and ensure your next response ends with one of these tools.`,

	execution: `You did not end your turn with a required tool call.

As a reminder, every message MUST end with exactly one of:
- \`complete_pulse\` — if you have completed this pulse's work
- \`request_extension\` — if additional work remains

Please continue and ensure your next response ends with one of these tools.`,
};

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
	 * 6. Nudges the agent if it didn't use a terminal tool
	 *
	 * @param userMessage - The user's message to the agent
	 * @param options - Optional callbacks for streaming events
	 * @param nudgeCount - Internal counter for nudge recursion (do not set manually)
	 */
	async run(
		userMessage: string,
		options: RunOptions = {},
		nudgeCount = 0,
	): Promise<void> {
		const agentConfig = getAgentConfig(this.session.agentRole);

		log.agent.info(
			`Running agent [${this.session.agentRole}] for session ${this.session.id}${nudgeCount > 0 ? ` (nudge ${nudgeCount})` : ""}`,
		);
		log.agent.debug(
			`User message: ${userMessage.slice(0, 100)}${userMessage.length > 100 ? "..." : ""}`,
		);

		// Load existing conversation history for this session
		const historyContext = await this.loadConversationHistory();
		log.agent.debug(
			`Loaded ${this.conversationHistory.length} messages from history`,
		);

		// Create user turn and add to history
		// Nudge turns are hidden from UI
		const isNudge = nudgeCount > 0;
		const userTurn = await this.createTurn("user", isNudge);
		await this.saveMessage(userTurn.id, 0, userMessage);
		await this.completeTurn(userTurn.id);

		// Build user message with optional context prefix
		// Tool summaries and notes are injected into the user message to avoid
		// multiple system messages (which some LLMs don't support)
		const notesContent = await this.buildNotesContent();
		const contextParts: string[] = [];

		if (historyContext.toolSummaries.length > 0) {
			const toolSummarySection = `## Previous Tool Usage\n\nEarlier in this conversation, you executed the following tools (results omitted for brevity):\n\n${historyContext.toolSummaries.join("\n")}`;
			contextParts.push(toolSummarySection);
		}
		if (notesContent) {
			contextParts.push(notesContent);
		}

		const userMessageContent =
			contextParts.length > 0
				? `<system_note>\n${contextParts.join("\n\n")}\n</system_note>\n\n${userMessage}`
				: userMessage;

		const userMsg: UserModelMessage = {
			role: "user",
			content: userMessageContent,
		};
		this.conversationHistory.push(userMsg);

		// Create assistant turn (also hidden if this is a nudge)
		const assistantTurn = await this.createTurn("assistant", isNudge);

		try {
			await this.streamLLMResponse(assistantTurn, agentConfig, options);
			await this.completeTurn(assistantTurn.id);
			log.agent.success(`Agent turn ${assistantTurn.id} completed`);

			// Check if a terminal tool was called - if not, nudge the agent
			await this.maybeNudge(assistantTurn.id, options, nudgeCount);
		} catch (error) {
			log.agent.error(`Agent turn ${assistantTurn.id} failed:`, error);
			await this.errorTurn(
				assistantTurn.id,
				error instanceof Error ? error.message : "Unknown error",
			);
			throw error;
		}
	}

	/**
	 * Check if the turn ended with a terminal tool; if not, nudge the agent
	 */
	private async maybeNudge(
		turnId: string,
		options: RunOptions,
		currentNudgeCount: number,
	): Promise<void> {
		const role = this.session.agentRole;
		const terminalTools = TERMINAL_TOOLS[role];

		// Skip nudging for roles that don't require terminal tools
		if (!terminalTools || terminalTools.length === 0) {
			return;
		}

		// Check if we've exceeded max nudges
		if (currentNudgeCount >= MAX_NUDGES) {
			log.agent.warn(
				`Agent [${role}] did not use terminal tool after ${MAX_NUDGES} nudges - giving up`,
			);
			return;
		}

		// Query tools called in this turn
		const toolsCalled = await this.config.db
			.selectFrom("turn_tools")
			.select("tool_name")
			.where("turn_id", "=", turnId)
			.execute();

		const toolNames = toolsCalled.map((t) => t.tool_name);
		const hasTerminalTool = toolNames.some((name) =>
			terminalTools.includes(name),
		);

		if (hasTerminalTool) {
			log.agent.debug(`Turn ended with terminal tool: ${toolNames.join(", ")}`);
			return;
		}

		// No terminal tool - nudge the agent
		const nudgeMessage = NUDGE_MESSAGES[role];
		if (!nudgeMessage) {
			log.agent.warn(`No nudge message configured for role: ${role}`);
			return;
		}

		log.agent.info(
			`Agent [${role}] did not use terminal tool (tools called: ${toolNames.join(", ") || "none"}) - nudging`,
		);

		// Recursively call run with the nudge message
		await this.run(nudgeMessage, options, currentNudgeCount + 1);
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
	 * call/result details. Older tools are summarized and returned separately
	 * to be injected into the current user message.
	 *
	 * @returns Context to inject into the current user message
	 */
	private async loadConversationHistory(): Promise<{
		toolSummaries: string[];
	}> {
		// Get all completed turns for this session via repository
		const { turns, nextTurnIndex } =
			await this.config.conversationRepo.loadSessionContext(this.session.id);

		// Update turn index to continue from where we left off
		this.turnIndex = nextTurnIndex;

		// First pass: collect all tools to determine which are "recent"
		const allTools: Array<{
			id: string;
			turnId: string;
			toolIndex: number;
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
					.orderBy("started_at", "asc")
					.execute();

				for (const tool of tools) {
					allTools.push({
						id: tool.id,
						turnId: turn.id,
						toolIndex: tool.tool_index,
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

		log.agent.debug(
			`History: ${allTools.length} total tools, ${recentToolIds.size} recent`,
		);

		// Build summaries for older tools (grouped by turn for context)
		const olderTools = allTools.filter((t) => !recentToolIds.has(t.id));
		const olderToolSummaries = this.buildToolSummaries(olderTools);

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
				// Get ALL tools for this turn first (for debugging)
				const allTurnTools = allTools.filter((t) => t.turnId === turn.id);

				// Get tools for this turn, filtering to only recent ones WITH output
				// (tools without output can't be included since Anthropic requires tool_result for every tool_use)
				const turnTools = allTurnTools.filter(
					(t) => recentToolIds.has(t.id) && t.outputJson !== null,
				);

				log.agent.debug(
					`Turn ${turn.turn_index}: ${allTurnTools.length} total tools, ${turnTools.length} recent with output`,
				);
				for (const tool of turnTools) {
					log.agent.debug(
						`  - ${tool.toolName} (id=${tool.id.slice(0, 20)}..., index=${tool.toolIndex}, hasOutput=${tool.outputJson !== null})`,
					);
				}

				// Build assistant message: all text first, then all tool calls
				// This matches the structure used for current-turn messages (see streamLLMResponse)
				// and works better with AI SDK's Anthropic format conversion
				const assistantParts: AssistantModelMessage["content"] = [];
				const toolResultParts: ToolResultPart[] = [];

				// Add all text segments first (in order)
				for (const msg of messages) {
					assistantParts.push({ type: "text", text: msg.content });
				}

				// Then add all tool calls (turnTools is already filtered to recent with output)
				for (const tool of turnTools) {
					assistantParts.push({
						type: "tool-call",
						toolCallId: tool.id,
						toolName: tool.toolName,
						input: JSON.parse(tool.inputJson),
					} satisfies ToolCallPart);

					// Collect tool result for separate message
					const toolOutput = JSON.parse(tool.outputJson as string);
					toolResultParts.push({
						type: "tool-result",
						toolCallId: tool.id,
						toolName: tool.toolName,
						output: {
							type: typeof toolOutput === "object" ? "json" : "text",
							value: toolOutput,
						},
					} satisfies ToolResultPart);
				}

				if (assistantParts.length > 0) {
					// Count tool calls in assistant parts
					const toolCallCount = assistantParts.filter(
						(p) => p.type === "tool-call",
					).length;
					const toolCallIds = assistantParts
						.filter((p) => p.type === "tool-call")
						.map((p) => (p as ToolCallPart).toolCallId);
					const toolResultIds = toolResultParts.map((p) => p.toolCallId);

					log.agent.debug(
						`Turn ${turn.turn_index}: ${toolCallCount} tool calls, ${toolResultParts.length} tool results`,
					);
					log.agent.debug(`  Tool call IDs: ${toolCallIds.join(", ")}`);
					log.agent.debug(`  Tool result IDs: ${toolResultIds.join(", ")}`);
					if (toolCallCount !== toolResultParts.length) {
						log.agent.error(`MISMATCH in count!`);
					}
					const missingResults = toolCallIds.filter(
						(id) => !toolResultIds.includes(id),
					);
					if (missingResults.length > 0) {
						log.agent.error(
							`MISSING RESULTS for IDs: ${missingResults.join(", ")}`,
						);
					}

					const assistantMsg: AssistantModelMessage = {
						role: "assistant",
						content: assistantParts,
					};
					this.conversationHistory.push(assistantMsg);

					// Add tool results in a separate message (required by Anthropic API)
					if (toolResultParts.length > 0) {
						const toolMsg: ToolModelMessage = {
							role: "tool",
							content: toolResultParts,
						};
						this.conversationHistory.push(toolMsg);
					}
				}
			}
		}

		log.agent.debug(
			`loadConversationHistory complete: ${this.conversationHistory.length} messages built`,
		);

		return { toolSummaries: olderToolSummaries };
	}

	/**
	 * Build a summary of older tool calls for context preservation.
	 * Returns an array of individual tool summaries.
	 */
	private buildToolSummaries(
		tools: Array<{
			toolName: string;
			reason: string | null;
			inputJson: string;
		}>,
	): string[] {
		return tools.map((tool) => {
			const input = JSON.parse(tool.inputJson);
			// Summarize input args - just show keys or truncated values
			const inputSummary = this.summarizeToolInput(input);
			const reasonPart = tool.reason ? ` for reason: "${tool.reason}"` : "";
			return `- You ran \`${tool.toolName}\` with input ${inputSummary}${reasonPart}`;
		});
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
	 * Build a note content string for the current context.
	 *
	 * Notes have different scoping based on context:
	 * - Channels: Notes persist across the entire channel lifetime (query by context_id)
	 * - Workflows: Notes are ephemeral per stage (query by session_id)
	 *
	 * Returns null if no notes exist.
	 */
	private async buildNotesContent(): Promise<string | null> {
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

		// Format notes
		const formattedNotes = notes
			.map((note, index) => `[Note ${index + 1}] ${note.content}`)
			.join("\n\n");

		return `## Your Notes\n\nYou have saved the following notes for yourself:\n\n${formattedNotes}`;
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
		// Segments: text is split into segments separated by tool calls
		// Tools store the segment index they appear AFTER (for proper interleaving)
		let currentSegmentBuffer = "";
		let currentSegmentIndex = 0;
		const completedSegments: Array<{ index: number; content: string }> = [];
		let thoughtBuffer = "";
		const activeToolCalls = new Map<string, ToolCall>();

		// Create the abort signal from session + options
		const signal =
			options.signal ?? this.session.abortController?.signal ?? undefined;

		// Log conversation history structure before API call
		log.agent.debug(
			`Sending ${this.conversationHistory.length} messages to LLM:`,
		);
		for (const [i, msg] of this.conversationHistory.entries()) {
			if (msg.role === "user") {
				const content =
					typeof msg.content === "string"
						? msg.content.slice(0, 50)
						: "[complex]";
				log.agent.debug(`  [${i}] user: ${content}...`);
			} else if (msg.role === "assistant") {
				const parts = Array.isArray(msg.content) ? msg.content : [msg.content];
				const textParts = parts.filter(
					(p) => typeof p === "string" || p.type === "text",
				).length;
				const toolParts = parts.filter(
					(p) => typeof p === "object" && p.type === "tool-call",
				).length;
				log.agent.debug(
					`  [${i}] assistant: ${textParts} text parts, ${toolParts} tool calls`,
				);
			} else if (msg.role === "tool") {
				const parts = Array.isArray(msg.content) ? msg.content : [msg.content];
				log.agent.debug(`  [${i}] tool: ${parts.length} results`);
			}
		}

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
					currentSegmentBuffer += part.text;

					// Broadcast delta to UI with segment index
					broadcast(
						createTurnMessageDeltaEvent({
							sessionId: this.session.id,
							turnId: turn.id,
							segmentIndex: currentSegmentIndex,
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
					// FLUSH current text segment before recording tool call
					// This creates the interleaved text -> tool -> text pattern
					if (currentSegmentBuffer.length > 0) {
						await this.saveMessage(
							turn.id,
							currentSegmentIndex,
							currentSegmentBuffer,
						);
						broadcast(
							createTurnSegmentCompleteEvent({
								sessionId: this.session.id,
								turnId: turn.id,
								segmentIndex: currentSegmentIndex,
								content: currentSegmentBuffer,
							}),
						);
						completedSegments.push({
							index: currentSegmentIndex,
							content: currentSegmentBuffer,
						});
						currentSegmentIndex++;
						currentSegmentBuffer = "";
					}

					// Tool call started - get ID from the event
					// The tool-call type has toolCallId from BaseToolCall
					const toolCallId = part.toolCallId;
					log.tools.info(`Tool call: ${part.toolName}`);
					// Use currentSegmentIndex as tool_index - this means the tool
					// appears AFTER segment N (for proper interleaving)
					const toolCall = await this.recordToolStart(
						turn.id,
						currentSegmentIndex,
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
						log.tools.success(`Tool completed: ${toolCall.toolName}`);
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
						log.tools.error(`Tool failed: ${toolCall.toolName}`, part.error);
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

		// Save any remaining text as the final segment
		if (currentSegmentBuffer.length > 0) {
			await this.saveMessage(
				turn.id,
				currentSegmentIndex,
				currentSegmentBuffer,
			);
			completedSegments.push({
				index: currentSegmentIndex,
				content: currentSegmentBuffer,
			});
		}

		// Save thoughts if we have any
		if (thoughtBuffer.length > 0) {
			await this.saveThought(turn.id, 0, thoughtBuffer);
		}

		// Add assistant response to conversation history for context
		// Build interleaved content: text segments and tool calls ordered by their indices
		const assistantParts: AssistantModelMessage["content"] = [];

		// Convert tool calls to array with their indices for interleaving
		const toolCallsArray = Array.from(activeToolCalls.values());

		// Simple approach: add all text segments first, then all tool calls
		// The LLM understands this pattern well
		for (const segment of completedSegments) {
			assistantParts.push({ type: "text", text: segment.content });
		}

		for (const toolCall of toolCallsArray) {
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

	private async createTurn(
		role: "user" | "assistant",
		hidden = false,
	): Promise<Turn> {
		const now = Date.now();
		const turnId = ids.turn();
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
				hidden: hidden ? 1 : 0,
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
			hidden,
			createdAt: now,
		};

		// Don't broadcast turn started for hidden turns
		if (!hidden) {
			broadcast(
				createTurnStartedEvent({
					sessionId: this.session.id,
					turnId,
					role,
				}),
			);
		}

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
		const messageId = ids.message();

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
				index: toolIndex,
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
		const thoughtId = ids.thought();

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
