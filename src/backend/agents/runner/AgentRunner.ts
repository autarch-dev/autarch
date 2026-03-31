/**
 * AgentRunner - Executes a single agent session via Vercel AI SDK
 *
 * Handles:
 * - Running the LLM with the agent's configuration
 * - Streaming responses to the UI via WebSocket
 * - Executing tool calls (handled by AI SDK)
 * - Persisting turns, messages, tools, and thoughts
 *
 * Extends BaseAgentRunner which provides shared logic for:
 * - Post-turn handling (nudge, continue, auto-transition)
 * - DB persistence helpers
 * - Tool context construction
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import type {
	AssistantModelMessage,
	ModelMessage,
	ToolCallPart,
	ToolModelMessage,
	ToolResultPart,
	UserModelMessage,
} from "@ai-sdk/provider-utils";
import { hasToolCall, stepCountIs, streamText } from "ai";
import { getKnowledgeDb } from "@/backend/db/knowledge";
import { convertToAISDKTools, getModelForScenario } from "@/backend/llm";
import { log } from "@/backend/logger";
import { getCostCalculator } from "@/backend/services/cost";
import { isExaKeyConfigured } from "@/backend/services/globalSettings";
import { KnowledgeRepository } from "@/backend/services/knowledge/repository";
import {
	askQuestionsTool,
	completeReviewTool,
	requestExtensionTool,
	submitPlanTool,
} from "@/backend/tools";
import {
	submitResearchTool,
	submitRoadmapTool,
	submitScopeTool,
} from "@/backend/tools/blocks";
import { submitPersonaRoadmapTool } from "@/backend/tools/roadmap/submitPersonaRoadmap";
import { broadcast } from "@/backend/ws";
import {
	createTurnMessageDeltaEvent,
	createTurnSegmentCompleteEvent,
} from "@/shared/schemas/events";
import { getAgentConfig } from "../registry";
import { BaseAgentRunner } from "./BaseAgentRunner";
import type { RunOptions, ToolCall, Turn } from "./types";
import { hasToolResult } from "./util";

// =============================================================================
// Constants
// =============================================================================

/** Maximum number of tool execution steps before stopping */
const MAX_TOOL_STEPS = 25;

/** Number of recent tools to include with full details */
const RECENT_TOOLS_LIMIT = 5;

// =============================================================================
// AgentRunner
// =============================================================================

export class AgentRunner extends BaseAgentRunner {
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
		// Clone to avoid mutating the shared registry singleton
		const agentConfig = { ...getAgentConfig(this.session.agentRole) };

		// Allow callers to override the tool set while keeping the persona's system prompt
		if (this.config.toolsOverride) {
			agentConfig.tools = this.config.toolsOverride;
		}

		log.agent.info(
			`Running agent [${this.session.agentRole}] for session ${this.session.id}${nudgeCount > 0 ? ` (nudge ${nudgeCount})` : ""}`,
		);
		log.agent.debug(
			`User message: ${userMessage.slice(0, 100)}${userMessage.length > 100 ? "..." : ""}`,
		);

		const knowledgeDb = await getKnowledgeDb(this.config.projectRoot);
		const knowledgeRepo = new KnowledgeRepository(knowledgeDb);

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

		const injection = options.knowledgeInjection;
		if (injection?.items.length) {
			try {
				await knowledgeRepo.insertKnowledgeInjectionEvents({
					sessionId: this.session.id,
					turnId: userTurn.id,
					agentRole: options.agentRole ?? this.session.agentRole,
					workflowId: options.workflowId ?? null,
					workflowStage: options.workflowStage ?? null,
					queryText: injection.queryText,
					tokenBudget: injection.tokenBudget,
					truncated: injection.truncated,
					items: injection.items.map((item) => ({
						knowledgeItemId: item.knowledgeItemId,
						similarity: item.similarity,
					})),
				});
			} catch (error) {
				log.agent.warn(
					`Failed to persist knowledge injection events for session ${this.session.id}, turn ${userTurn.id}`,
					error,
				);
			}
		}

		// Build user message with optional context prefix
		// Tool summaries and notes are injected into the user message to avoid
		// multiple system messages (which some LLMs don't support)
		const notesContent = await this.buildNotesContent();
		const todosContent = await this.buildTodosContent();
		const contextParts: string[] = [];

		if (toolSummaries.length > 0) {
			const toolSummarySection = `## Previous Tool Usage\n\nEarlier in this conversation, you executed the following tools (results omitted for brevity):\n\n${toolSummaries.join("\n")}`;
			contextParts.push(toolSummarySection);
		}
		if (notesContent) {
			contextParts.push(notesContent);
		}
		if (todosContent) {
			contextParts.push(todosContent);
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
			const {
				totalInputTokens,
				totalOutputTokens,
				totalCacheWriteTokens,
				totalCacheReadTokens,
				totalUncachedPromptTokens,
				totalCost,
			} = await this.streamLLMResponse(
				assistantTurn,
				agentConfig,
				options,
				conversationHistory,
			);
			log.agent.success(`Agent turn ${assistantTurn.id} completed`, {
				totalInputTokens,
				totalOutputTokens,
				totalCacheWriteTokens,
				totalCacheReadTokens,
				totalUncachedPromptTokens,
				totalCost,
			});

			// Check if a terminal tool was called - if not, nudge the agent
			await this.maybeNudge(
				assistantTurn.id,
				options,
				nudgeCount,
				agentConfig.tools,
			);

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

	// ===========================================================================
	// Conversation History
	// ===========================================================================

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
			originalToolCallId: string;
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
						originalToolCallId: tool.original_tool_id ?? tool.id,
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
			allTools.slice(-RECENT_TOOLS_LIMIT).map((t) => t.id),
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
						`  - ${tool.toolName} (id=${tool.id}, index=${tool.toolIndex}, hasOutput=${tool.outputJson !== null})`,
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
						toolCallId: tool.originalToolCallId,
						toolName: tool.toolName,
						input: toolInput,
					} satisfies ToolCallPart);

					// Collect tool result for separate message
					toolResultParts.push({
						type: "tool-result",
						toolCallId: tool.originalToolCallId,
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
	 * - Accumulate token usage
	 */
	private async streamLLMResponse(
		turn: Turn,
		agentConfig: ReturnType<typeof getAgentConfig>,
		options: RunOptions,
		conversationHistory: ModelMessage[],
	): Promise<{
		totalInputTokens: number;
		totalOutputTokens: number;
		totalCost: number;
		totalCacheWriteTokens: number;
		totalCacheReadTokens: number;
		totalUncachedPromptTokens: number;
	}> {
		// Get the model for this agent's scenario
		const { model, modelId } = await getModelForScenario(agentConfig.role);

		// Create a store to maintain tool results
		const toolResultMap = new Map<string, boolean>();

		// Create tool context based on session type (include turnId for artifact tracking)
		const toolContext = await this.createToolContext(toolResultMap, turn.id);

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

		// Derive the submit tool name from the actual tool set for persona prompt parameterization
		const submitToolName = agentConfig.tools.find(
			(t) => t.name === "submit_roadmap" || t.name === "submit_persona_roadmap",
		)?.name;

		// Read AGENTS.md or CLAUDE.md from repository root for research agent context
		let agentsMdContent: string | undefined;
		if (agentConfig.role === "research") {
			for (const filename of ["AGENTS.md", "CLAUDE.md"]) {
				try {
					agentsMdContent = await fs.readFile(
						path.join(this.config.projectRoot, filename),
						"utf-8",
					);
					break;
				} catch {
					// File doesn't exist, try next
				}
			}
		}

		// Start streaming with AI SDK
		const result = streamText({
			model,
			system: {
				content: agentConfig.systemPrompt({
					hasWebCodeSearch: hasExaKey,
					submitToolName,
					agentsMdContent,
				}),
				role: "system",
				providerOptions: {
					bedrock: { cachePoint: { type: "default", ttl: "5m" } },
				},
			},
			providerOptions: {
				anthropic: {
					cacheControl: {
						type: "ephemeral",
					},
				},
			},
			messages: conversationHistory,
			tools,
			stopWhen: [
				stepCountIs(MAX_TOOL_STEPS),
				hasToolCall(requestExtensionTool.name),
				hasToolCall(askQuestionsTool.name),
				hasToolCall(submitRoadmapTool.name),
				hasToolCall(submitPersonaRoadmapTool.name),
				hasToolCall(askQuestionsTool.name),
				hasToolCall(submitScopeTool.name),
				hasToolCall(submitResearchTool.name),
				hasToolCall(submitPlanTool.name),
				hasToolCall(completeReviewTool.name),
				hasToolResult("complete_pulse"), //We want to end on _successful_ tool calls for pulse completion, not _any_ tool call.
			],
			abortSignal: signal,
			prepareStep: ({ messages: stepMessages }) => {
				// Move the Bedrock cache breakpoint to the last user/tool message on every step.
				// This ensures cache coverage advances through tool-call loops, not just the initial user message.
				const cleaned = stepMessages.map((msg) => {
					if (!msg.providerOptions?.bedrock) return msg;
					const { bedrock: _, ...restProvider } = msg.providerOptions;
					return {
						...msg,
						providerOptions:
							Object.keys(restProvider).length > 0 ? restProvider : undefined,
					};
				});

				// Apply cachePoint to the last user or tool message
				for (let i = cleaned.length - 1; i >= 0; i--) {
					const msg = cleaned[i];
					if (msg && (msg.role === "user" || msg.role === "tool")) {
						cleaned[i] = {
							...msg,
							providerOptions: {
								...msg.providerOptions,
								bedrock: {
									cachePoint: { type: "default" },
								},
							},
						};
						break;
					}
				}

				return { messages: cleaned };
			},
			experimental_repairToolCall: async (options) => {
				log.agent.warn(
					`Attempting repair of tool call ${options.toolCall.toolName} (${options.toolCall.toolCallId})`,
				);

				const targetFolder = path.join(
					this.config.projectRoot,
					".autarch",
					"logs",
				);
				await fs.mkdir(targetFolder, { recursive: true });

				const targetFile = path.join(
					targetFolder,
					`${turn.id}_${options.toolCall.toolCallId}_input.txt`,
				);
				await fs.writeFile(targetFile, options.toolCall.input);

				const { result, fixedCount } = this.fixUnescapedTabs(
					options.toolCall.input,
				);

				if (fixedCount === 0) {
					log.agent.error("No unescaped tabs fixed -- aborting early");
					return null;
				}

				return {
					...options.toolCall,
					input: result,
				};
			},
			// Note: maxTokens and temperature are passed via providerOptions or model config
			maxOutputTokens: 32000,
		});

		let totalCacheWriteTokens = 0;
		let totalCacheReadTokens = 0;
		let totalUncachedPromptTokens = 0;
		let totalOutputTokens = 0;
		let totalCost = 0;

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
					// Include contextId/agentRole/pulseId to enable streaming message creation on reconnect
					broadcast(
						createTurnMessageDeltaEvent({
							sessionId: this.session.id,
							turnId: turn.id,
							segmentIndex: currentSegmentIndex,
							delta: part.text,
							contextType: this.session.contextType,
							contextId: this.session.contextId,
							agentRole: this.session.agentRole,
							pulseId: this.session.pulseId,
						}),
					);

					options.onMessageDelta?.(part.text);
					break;
				}

				case "reasoning-delta": {
					// Extended thinking / reasoning (Claude models)
					thoughtBuffer += part.text;

					// broadcast(
					// 	createTurnThoughtDeltaEvent({
					// 		sessionId: this.session.id,
					// 		turnId: turn.id,
					// 		delta: part.text,
					// 	}),
					// );

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
					log.tools.info(`Tool call: ${part.toolName}`);
					// Use currentSegmentIndex as tool_index - this means the tool
					// appears AFTER segment N (for proper interleaving)
					const toolCall = await this.recordToolStart(
						turn.id,
						currentSegmentIndex,
						part.toolCallId,
						part.toolName,
						part.input,
					);

					activeToolCalls.set(toolCall.originalToolCallId, toolCall);
					options.onToolStarted?.(toolCall);
					break;
				}

				case "tool-result": {
					// Tool execution completed (function ran without throwing)
					// Check the result's success field for application-level success
					const toolCall = activeToolCalls.get(part.toolCallId);

					if (toolCall) {
						const success = toolResultMap.get(toolCall.originalToolCallId);

						if (success) {
							log.tools.success(`Tool completed: ${toolCall.toolName}`);
						} else if (typeof success === "undefined") {
							log.tools.warn(
								`Failed to locate tool call result for ${toolCall.toolName} (${toolCall.id})`,
							);
						} else {
							log.tools.warn(`Tool returned failure: ${toolCall.toolName}`);
						}

						await this.recordToolComplete(toolCall, part.output, !!success);
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
							JSON.stringify(part.error),
							false,
						);
						options.onToolCompleted?.(toolCall);
					}

					break;
				}

				case "finish-step": {
					// A step completed (may include tool calls)
					// We can track token usage here if needed
					log.tools.debug("Streaming step completed", part.usage);
					const stepUncachedPromptTokens =
						part.usage.inputTokenDetails.noCacheTokens ?? 0;
					const stepOutputTokens = part.usage.outputTokens ?? 0;
					const stepCacheWriteTokens =
						part.usage.inputTokenDetails.cacheWriteTokens ?? 0;
					const stepCacheReadTokens =
						part.usage.inputTokenDetails.cacheReadTokens ?? 0;

					let inputTokensForCostCalculation = stepUncachedPromptTokens;

					// Workaround for when the AI SDK doesn't provide token usage data
					if (
						stepUncachedPromptTokens === 0 &&
						stepCacheReadTokens === 0 &&
						stepCacheWriteTokens === 0
					) {
						inputTokensForCostCalculation = part.usage.inputTokens ?? 0;
						totalUncachedPromptTokens += inputTokensForCostCalculation;
					} else {
						totalUncachedPromptTokens += stepUncachedPromptTokens;
					}

					totalOutputTokens += stepOutputTokens;
					totalCacheWriteTokens += stepCacheWriteTokens;
					totalCacheReadTokens += stepCacheReadTokens;

					// Calculate cost per-step so long-context thresholds apply correctly
					totalCost += await getCostCalculator().calculate(
						modelId,
						inputTokensForCostCalculation,
						stepOutputTokens,
						stepCacheWriteTokens,
						stepCacheReadTokens,
					);
					break;
				}

				case "finish": {
					// Stream completed
					log.tools.debug("Streaming completed", part.totalUsage);

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
		const totalInputTokens =
			totalUncachedPromptTokens + totalCacheReadTokens + totalCacheWriteTokens;

		await this.completeTurn(turn.id, {
			tokenCount: totalInputTokens + totalOutputTokens,
			promptTokens: totalInputTokens,
			cost: totalCost,
			completionTokens: totalOutputTokens,
			uncachedPromptTokens: totalUncachedPromptTokens,
			cacheWriteTokens:
				totalCacheWriteTokens === 0 ? undefined : totalCacheWriteTokens,
			cacheReadTokens:
				totalCacheReadTokens === 0 ? undefined : totalCacheReadTokens,
			modelId,
		});

		return {
			totalInputTokens,
			totalOutputTokens,
			totalCost,
			totalCacheWriteTokens,
			totalCacheReadTokens,
			totalUncachedPromptTokens,
		};
	}

	// ===========================================================================
	// AI SDK Helpers
	// ===========================================================================

	private fixUnescapedTabs(jsonString: string) {
		let result = "";
		let inString = false;
		let fixedCount = 0;

		for (let i = 0; i < jsonString.length; i++) {
			const char = jsonString[i];
			const prevChar = i > 0 ? jsonString[i - 1] : null;

			// Check if current char is escaped (previous char is \ and that \ isn't itself escaped)
			const isEscaped =
				prevChar === "\\" && (i < 2 || jsonString[i - 2] !== "\\");

			if (char === '"' && !isEscaped) {
				inString = !inString;
			}

			if (char === "\t" && inString && !isEscaped) {
				fixedCount++;
				result += "\\t";
			} else {
				result += char;
			}
		}

		return { result, fixedCount };
	}
}
