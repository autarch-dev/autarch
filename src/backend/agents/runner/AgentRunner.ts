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
import { getRepositories } from "@/backend/repositories";
import { isExaKeyConfigured } from "@/backend/services/globalSettings";
import type { ToolContext } from "@/backend/tools/types";
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
import { getWorkflowOrchestrator } from "./WorkflowOrchestrator";

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

Please continue and ensure your next response ends with one of these tools.
If no work remains, call \`submit_scope\` and yield to the user.`,

	research: `You did not end your turn with a required tool call.

As a reminder, every message MUST end with exactly one of:
- \`submit_research\` — if you have sufficient understanding to guide implementation
- \`request_extension\` — if any investigation remains
- \`ask_questions\` — if user input is required to resolve ambiguity

Please continue and ensure your next response ends with one of these tools.
If no work remains, call \`submit_research\` and yield to the user.`,

	planning: `You did not end your turn with a required tool call.

As a reminder, every message MUST end with exactly one of:
- \`submit_plan\` — if you have a complete implementation plan
- \`ask_questions\` — if you need clarification from the user

Please continue and ensure your next response ends with one of these tools.
If no work remains, call \`submit_plan\` and yield to the user.`,

	execution: `You did not end your turn with a required tool call.

As a reminder, every message MUST end with exactly one of:
- \`complete_pulse\` — if you have completed this pulse's work
- \`request_extension\` — if additional work remains

Please continue and ensure your next response ends with one of these tools.
If no work remains, call \`complete_pulse\` and yield to the user.`,
};

// =============================================================================
// AgentRunner
// =============================================================================

export class AgentRunner {
	private readonly session: ActiveSession;
	private readonly config: RunnerConfig;

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
		const {
			messages: conversationHistory,
			toolSummaries,
			nextTurnIndex,
		} = await this.loadConversationHistory();
		let turnIndex = nextTurnIndex;
		log.agent.debug(
			`Loaded ${conversationHistory.length} messages from history`,
		);

		// Create user turn and add to history
		// Nudge turns and explicitly hidden user turns are hidden from UI
		// The hidden option is for transition messages (approved artifacts) - we want
		// to hide those but still show the agent's response
		const isUserTurnHidden = nudgeCount > 0 || options.hidden === true;
		const userTurn = await this.createTurn(
			"user",
			isUserTurnHidden,
			turnIndex++,
		);
		await this.saveMessage(userTurn.id, 0, userMessage);
		await this.completeTurn(userTurn.id);

		// Build user message with optional context prefix
		// Tool summaries and notes are injected into the user message to avoid
		// multiple system messages (which some LLMs don't support)
		const notesContent = await this.buildNotesContent();
		const contextParts: string[] = [];

		if (toolSummaries.length > 0) {
			const toolSummarySection = `## Previous Tool Usage\n\nEarlier in this conversation, you executed the following tools (results omitted for brevity):\n\n${toolSummaries.join("\n")}`;
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
		conversationHistory.push(userMsg);

		const assistantTurn = await this.createTurn(
			"assistant",
			false,
			turnIndex++,
		);

		try {
			// streamLLMResponse handles turn completion with token usage data
			await this.streamLLMResponse(
				assistantTurn,
				agentConfig,
				options,
				conversationHistory,
			);
			log.agent.success(`Agent turn ${assistantTurn.id} completed`);

			// Check if a terminal tool was called - if not, nudge the agent
			await this.maybeNudge(assistantTurn.id, options, nudgeCount);

			// Check if request_extension was called - if so, auto-continue
			await this.maybeContinue(assistantTurn.id, options);

			// Check if auto-transition tools were called (complete_preflight, complete_pulse)
			// These transitions are deferred to here so the session isn't aborted mid-stream
			await this.maybeAutoTransition(assistantTurn.id);
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

		// Query tool names via repository
		const toolNames = await this.config.conversationRepo.getToolNames(turnId);
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

	/**
	 * Check if the turn ended with request_extension; if so, auto-continue
	 */
	private async maybeContinue(
		turnId: string,
		options: RunOptions,
	): Promise<void> {
		// Query tool names for this turn
		const toolNames = await this.config.conversationRepo.getToolNames(turnId);

		// Check if request_extension was called
		if (!toolNames.includes("request_extension")) {
			return;
		}

		// Check if a "completion" terminal tool was also called - those take precedence
		// over request_extension. This handles the case where the agent mistakenly
		// calls both (e.g., submit_research AND request_extension in the same turn)
		const role = this.session.agentRole;
		const terminalTools = TERMINAL_TOOLS[role] ?? [];
		const completionTools = terminalTools.filter(
			(t) => t !== "request_extension",
		);
		const hasCompletionTool = toolNames.some((name) =>
			completionTools.includes(name),
		);

		if (hasCompletionTool) {
			log.agent.warn(
				`Agent called both request_extension and a completion tool (${toolNames.join(", ")}) - ignoring extension`,
			);
			return;
		}

		log.agent.info(`Agent requested extension - auto-continuing`);

		// Continue with a simple prompt (reset nudge count for fresh allowance)
		// Hide the continuation message from UI
		await this.run("Continue.", { ...options, hidden: true }, 0);
	}

	/**
	 * Check if auto-transition tools were called and trigger deferred transitions
	 *
	 * For complete_preflight and complete_pulse, the actual transition (starting
	 * the next session) is deferred to here so we don't abort the stream mid-turn.
	 */
	private async maybeAutoTransition(turnId: string): Promise<void> {
		// Only workflow sessions can have auto-transitions
		if (this.session.contextType !== "workflow") {
			return;
		}

		const toolNames = await this.config.conversationRepo.getToolNames(turnId);

		// Check if any auto-transition tools were called
		const hasPreflightComplete = toolNames.includes("complete_preflight");
		const hasPulseComplete = toolNames.includes("complete_pulse");

		if (!hasPreflightComplete && !hasPulseComplete) {
			return;
		}

		// Trigger the deferred transition via orchestrator
		try {
			const orchestrator = getWorkflowOrchestrator();
			await orchestrator.handleTurnCompletion(
				this.session.contextId, // workflowId
				toolNames,
			);
		} catch (error) {
			log.agent.error(
				`Failed to handle auto-transition for workflow ${this.session.contextId}:`,
				error,
			);
			// Don't re-throw - the turn already completed successfully
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
	 * call/result details. Older tools are summarized and returned separately
	 * to be injected into the current user message.
	 *
	 * NOTE: We bypass Zod validation when reading history because:
	 * 1. We wrote this data ourselves (validated on write)
	 * 2. The type gymnastics between Zod's JsonValue and AI SDK's JSONValue are painful
	 * 3. This is read-path only - write-path still validates
	 *
	 * @returns Messages array, tool summaries for older tools, and next turn index
	 */
	private async loadConversationHistory(): Promise<{
		messages: ModelMessage[];
		toolSummaries: string[];
		nextTurnIndex: number;
	}> {
		const repo = this.config.conversationRepo;
		const messages: ModelMessage[] = [];

		// Get all completed turns for this session via repository
		const { turns, nextTurnIndex } = await repo.loadSessionContext(
			this.session.id,
		);

		// First pass: collect all tools to determine which are "recent"
		// We trust the JSON since we validated on write - no need for Zod overhead here
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
				const tools = await repo.getTools(turn.id);

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
			// Get messages for this turn via repository
			const turnMessages = await repo.getMessages(turn.id);

			if (turn.role === "user") {
				// User turns are simple text
				const content = turnMessages.map((m) => m.content).join("\n");
				const userMsg: UserModelMessage = {
					role: "user",
					content,
				};
				messages.push(userMsg);
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
				for (const msg of turnMessages) {
					assistantParts.push({ type: "text", text: msg.content });
				}

				// Then add all tool calls (turnTools is already filtered to recent with output)
				// We use raw JSON.parse here - data was validated on write, no need to re-validate
				for (const tool of turnTools) {
					const toolInput = JSON.parse(tool.inputJson);
					const toolOutput = JSON.parse(tool.outputJson as string);

					assistantParts.push({
						type: "tool-call",
						toolCallId: tool.id,
						toolName: tool.toolName,
						input: toolInput,
					} satisfies ToolCallPart);

					// Collect tool result for separate message
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
					messages.push(assistantMsg);

					// Add tool results in a separate message (required by Anthropic API)
					if (toolResultParts.length > 0) {
						const toolMsg: ToolModelMessage = {
							role: "tool",
							content: toolResultParts,
						};
						messages.push(toolMsg);
					}
				}
			}
		}

		log.agent.debug(
			`loadConversationHistory complete: ${messages.length} messages built`,
		);

		return { messages, toolSummaries: olderToolSummaries, nextTurnIndex };
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
		const repo = this.config.conversationRepo;
		let notes: Array<{ id: string; content: string; createdAt: number }>;

		if (this.session.contextType === "channel") {
			// For channels: notes persist across channel lifetime
			notes = await repo.getNotes("channel", this.session.contextId);
		} else {
			// For workflows: notes are ephemeral per stage (session)
			notes = await repo.getNotes(
				"workflow",
				this.session.contextId,
				this.session.id,
			);
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
		conversationHistory: ModelMessage[],
	): Promise<void> {
		// Get the model for this agent's scenario
		const { model, modelId } = await getModelForScenario(agentConfig.role);

		// Create tool context based on session type (include turnId for artifact tracking)
		const toolContext = this.createToolContext(turn.id);

		// Check if Exa API key is configured for web search tools
		const hasExaKey = await isExaKeyConfigured();

		// Convert our tools to AI SDK format
		const tools = convertToAISDKTools(agentConfig.tools, toolContext, {
			hasExaKey,
		});

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
		log.agent.debug(`Sending ${conversationHistory.length} messages to LLM:`);
		for (const [i, msg] of conversationHistory.entries()) {
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
			system: agentConfig.systemPrompt({ hasWebCodeSearch: hasExaKey }),
			messages: conversationHistory,
			tools,
			stopWhen: stepCountIs(MAX_TOOL_STEPS),
			abortSignal: signal,
			// Note: maxTokens and temperature are passed via providerOptions or model config
		});

		let totalInputTokens = 0;
		let totalOutputTokens = 0;

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
					console.log(
						"finish-step",
						part.usage.inputTokens,
						part.usage.outputTokens,
					);
					totalInputTokens += part.usage.inputTokens ?? 0;
					totalOutputTokens += part.usage.outputTokens ?? 0;
					break;
				}

				case "finish": {
					// Stream completed
					console.log(
						"finish",
						part.totalUsage.inputTokens,
						part.totalUsage.outputTokens,
					);
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

		// Complete the turn with token usage data
		await this.completeTurn(turn.id, {
			tokenCount: totalInputTokens + totalOutputTokens,
			promptTokens: totalInputTokens,
			completionTokens: totalOutputTokens,
			modelId,
		});
	}

	// ===========================================================================
	// Tool Context
	// ===========================================================================

	/**
	 * Create the appropriate tool context based on session type
	 */
	private createToolContext(turnId?: string): ToolContext {
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
			turnId,
			this.config.worktreePath,
		);
	}

	// ===========================================================================
	// Turn Management
	// ===========================================================================

	private async createTurn(
		role: "user" | "assistant",
		hidden: boolean,
		turnIndex: number,
	): Promise<Turn> {
		const repo = this.config.conversationRepo;

		// Use repository for DB operation
		const turnData = await repo.createTurn({
			sessionId: this.session.id,
			turnIndex,
			role,
			hidden,
		});

		const turn: Turn = {
			id: turnData.id,
			sessionId: this.session.id,
			turnIndex,
			role,
			status: "streaming",
			hidden,
			createdAt: turnData.createdAt,
		};

		// For review agent assistant turns, associate orphaned review cards with this turn
		if (
			role === "assistant" &&
			this.session.contextType === "workflow" &&
			this.session.agentRole === "review"
		) {
			const { artifacts } = getRepositories();
			await artifacts.setReviewCardTurnId(this.session.contextId, turn.id);
		}

		// Don't broadcast turn started for hidden turns
		if (!hidden) {
			broadcast(
				createTurnStartedEvent({
					sessionId: this.session.id,
					turnId: turn.id,
					role,
				}),
			);
		}

		return turn;
	}

	private async completeTurn(
		turnId: string,
		usage?: {
			tokenCount?: number;
			promptTokens?: number;
			completionTokens?: number;
			modelId?: string;
		},
	): Promise<void> {
		// Use repository for DB operation
		await this.config.conversationRepo.completeTurn(turnId, usage);

		broadcast(
			createTurnCompletedEvent({
				sessionId: this.session.id,
				turnId,
				tokenCount: usage?.tokenCount,
			}),
		);
	}

	private async errorTurn(turnId: string, _error: string): Promise<void> {
		// Use repository for DB operation
		await this.config.conversationRepo.errorTurn(turnId);
	}

	// ===========================================================================
	// Message Management
	// ===========================================================================

	private async saveMessage(
		turnId: string,
		messageIndex: number,
		content: string,
	): Promise<void> {
		// Use repository for DB operation
		await this.config.conversationRepo.saveMessage(
			turnId,
			messageIndex,
			content,
		);
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

		// Use repository with explicit ID from AI SDK
		await this.config.conversationRepo.recordToolStart({
			id: toolCallId,
			turnId,
			toolIndex,
			toolName,
			reason,
			input,
		});

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

		// Use repository for DB operation with safe JSON serialization
		await this.config.conversationRepo.recordToolComplete(
			toolCall.id,
			output,
			success,
		);

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
		// Use repository for DB operation
		await this.config.conversationRepo.saveThought(
			turnId,
			thoughtIndex,
			content,
		);
	}
}
