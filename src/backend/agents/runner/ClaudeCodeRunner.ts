/**
 * ClaudeCodeRunner - Executes agent sessions via Claude Code CLI
 *
 * Spawns `claude -p --bare` as a subprocess and maps its output
 * to Autarch's persistence layer and WebSocket events.
 *
 * Key differences from AgentRunner:
 * - No conversation history loading — Claude Code manages its own context
 * - Uses `--resume <sessionId>` for nudge/continue continuity
 * - Tool execution happens via MCP (in-process HTTP), not in the stream
 * - Terminal tools are handled by the MCP handler which signals process kill
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { getKnowledgeDb } from "@/backend/db/knowledge";
import { log } from "@/backend/logger";
import { getAllowedTools } from "@/backend/mcp/allowedTools";
import {
	cleanupMcpConfig,
	generateMcpConfig,
} from "@/backend/mcp/generateMcpConfig";
import type { KillableRunner } from "@/backend/mcp/runnerRegistry";
import { deregisterRunner, registerRunner } from "@/backend/mcp/runnerRegistry";
import { parseClaudeStream } from "@/backend/mcp/streamParser";
import { isExaKeyConfigured } from "@/backend/services/globalSettings";
import { KnowledgeRepository } from "@/backend/services/knowledge/repository";
import { broadcast } from "@/backend/ws";
import {
	createTurnMessageDeltaEvent,
	createTurnSegmentCompleteEvent,
} from "@/shared/schemas/events";
import { getAgentConfig } from "../registry";
import { BaseAgentRunner } from "./BaseAgentRunner";
import type { RunOptions, ToolCall } from "./types";

// =============================================================================
// Claude Code Session ID Cache
// =============================================================================

import {
	activeTurnIds,
	activeWorktreePaths,
	ccSessionIds,
} from "@/backend/mcp/sessionState";

// =============================================================================
// ClaudeCodeRunner
// =============================================================================

export class ClaudeCodeRunner
	extends BaseAgentRunner
	implements KillableRunner
{
	/** Set by MCP handler when a terminal tool fires */
	private shouldTerminate = false;

	// ===========================================================================
	// KillableRunner interface
	// ===========================================================================

	scheduleTermination(): void {
		this.shouldTerminate = true;
	}

	// ===========================================================================
	// Main Execution
	// ===========================================================================

	async run(
		userMessage: string,
		options: RunOptions = {},
		nudgeCount = 0,
		_cacheUserMessage = false,
	): Promise<void> {
		const agentConfig = { ...getAgentConfig(this.session.agentRole) };

		if (this.config.toolsOverride) {
			agentConfig.tools = this.config.toolsOverride;
		}

		log.agent.info(
			`[ClaudeCode] Running agent [${this.session.agentRole}] for session ${this.session.id}${nudgeCount > 0 ? ` (nudge ${nudgeCount})` : ""}`,
		);

		const knowledgeDb = await getKnowledgeDb(this.config.projectRoot);
		const knowledgeRepo = new KnowledgeRepository(knowledgeDb);

		// Load next turn index from DB (we still track turns for UI)
		const { nextTurnIndex } =
			await this.config.conversationRepo.loadSessionContext(this.session.id);
		let turnIndex = nextTurnIndex;

		// Create user turn
		const isUserTurnHidden = nudgeCount > 0 || options.hidden === true;
		const userTurn = await this.createTurn(
			"user",
			isUserTurnHidden,
			turnIndex++,
		);
		await this.saveMessage(userTurn.id, 0, userMessage);
		await this.completeTurn(userTurn.id);

		// Persist knowledge injection events (same as AgentRunner)
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

		// Build user message with notes/todos context (same as AgentRunner)
		const notesContent = await this.buildNotesContent();
		const todosContent = await this.buildTodosContent();
		const contextParts: string[] = [];
		if (notesContent) contextParts.push(notesContent);
		if (todosContent) contextParts.push(todosContent);

		const fullMessage =
			contextParts.length > 0
				? `<system_note>\n${contextParts.join("\n\n")}\n</system_note>\n\n${userMessage}`
				: userMessage;

		// Create assistant turn
		const assistantTurn = await this.createTurn(
			"assistant",
			false,
			turnIndex++,
		);

		// Share state with MCP handler
		activeTurnIds.set(this.session.id, assistantTurn.id);
		if (this.config.worktreePath) {
			activeWorktreePaths.set(this.session.id, this.config.worktreePath);
		}

		try {
			// Generate system prompt
			const hasExaKey = await isExaKeyConfigured();
			const submitToolName = agentConfig.tools.find(
				(t) =>
					t.name === "submit_roadmap" || t.name === "submit_persona_roadmap",
			)?.name;

			const systemPrompt = agentConfig.systemPrompt({
				hasWebCodeSearch: hasExaKey,
				submitToolName,
			});

			// Generate MCP config
			const mcpConfigPath = await generateMcpConfig(
				this.config.projectRoot,
				this.session.id,
			);

			// Register this runner for MCP kill signaling
			this.shouldTerminate = false;
			registerRunner(this.session.id, this);

			try {
				// Write system prompt to temp file (can be large)
				const promptPath = path.join(
					this.config.projectRoot,
					".autarch",
					"tmp",
					`prompt-${this.session.id}.txt`,
				);
				await fs.writeFile(promptPath, systemPrompt);

				// Resolve model alias for this agent role
				const { getClaudeCodeModelForRole } = await import(
					"@/backend/services/globalSettings"
				);
				const modelAlias = await getClaudeCodeModelForRole(
					this.session.agentRole,
				);

				// Build CLI args
				const args = this.buildCliArgs(mcpConfigPath, promptPath, modelAlias);

				// Spawn claude -p
				const usage = await this.spawnAndStream(
					args,
					fullMessage,
					assistantTurn.id,
					options,
				);

				// Complete assistant turn
				await this.completeTurn(assistantTurn.id, {
					modelId: "claude-code",
					promptTokens: usage.inputTokens,
					completionTokens: usage.outputTokens,
					tokenCount: usage.inputTokens + usage.outputTokens,
					cost: usage.costUsd ?? 0,
				});

				log.agent.success(
					`[ClaudeCode] Agent turn ${assistantTurn.id} completed`,
				);

				// Post-turn hooks (inherited from BaseAgentRunner)
				await this.maybeNudge(
					assistantTurn.id,
					options,
					nudgeCount,
					agentConfig.tools,
				);
				await this.maybeContinue(assistantTurn.id, options);
				await this.maybeAutoTransition(assistantTurn.id);

				// Clean up temp prompt file
				await fs.unlink(promptPath).catch(() => {});
			} finally {
				deregisterRunner(this.session.id);
				activeTurnIds.delete(this.session.id);
				activeWorktreePaths.delete(this.session.id);
				await cleanupMcpConfig(this.config.projectRoot, this.session.id);
			}
		} catch (error) {
			log.agent.error(
				`[ClaudeCode] Agent turn ${assistantTurn.id} failed:`,
				error,
			);
			await this.errorTurn(
				assistantTurn.id,
				error instanceof Error ? error.message : "Unknown error",
			);
			throw error;
		}
	}

	// ===========================================================================
	// CLI Arguments
	// ===========================================================================

	private buildCliArgs(
		mcpConfigPath: string,
		promptPath: string,
		modelAlias: string,
	): string[] {
		const args = [
			"claude",
			"-p",
			"--output-format",
			"stream-json",
			"--verbose",
			"--include-partial-messages",
			"--model",
			modelAlias,
			"--mcp-config",
			mcpConfigPath,
			"--strict-mcp-config",
			"--append-system-prompt-file",
			promptPath,
			"--tools",
			getAllowedTools(this.session.agentRole),
			"--permission-mode",
			"acceptEdits",
			"--disable-slash-commands",
			"--no-chrome",
		];

		// Resume existing Claude Code session for nudge/continue
		const ccSessionId = ccSessionIds.get(this.session.id);
		if (ccSessionId) {
			args.push("--resume", ccSessionId);
		}

		return args;
	}

	// ===========================================================================
	// Subprocess Management & Stream Processing
	// ===========================================================================

	private async spawnAndStream(
		args: string[],
		message: string,
		turnId: string,
		options: RunOptions,
	): Promise<{
		inputTokens: number;
		outputTokens: number;
		costUsd: number | null;
	}> {
		const cwd = this.config.worktreePath ?? this.config.projectRoot;

		log.agent.debug(`[ClaudeCode] Spawning: ${args.join(" ")} (cwd: ${cwd})`);

		const proc = Bun.spawn(args, {
			cwd,
			stdin: "pipe",
			stdout: "pipe",
			stderr: "pipe",
			env: { ...process.env },
		});

		// Write message to stdin, then close to signal EOF
		proc.stdin.write(message);
		proc.stdin.end();

		// Collect stderr concurrently (must start before stdout consumption)
		const stderrPromise = new Response(proc.stderr).text();

		// Set up abort handling
		const signal = options.signal ?? this.session.abortController?.signal;
		const abortHandler = () => {
			log.agent.debug(`[ClaudeCode] Abort signal received — killing process`);
			proc.kill("SIGTERM");
		};
		signal?.addEventListener("abort", abortHandler);

		// Internal CC tools we don't track in the UI
		const IGNORED_TOOLS = new Set([
			"ToolSearch",
			"Agent",
			"TodoWrite",
			"NotebookEdit",
			"EnterPlanMode",
			"ExitPlanMode",
			"EnterWorktree",
			"ExitWorktree",
		]);

		// Track streaming state
		let currentSegmentBuffer = "";
		let currentSegmentIndex = 0;
		const toolInputBuffers = new Map<string, string>();
		const toolNames = new Map<string, string>(); // toolCallId → toolName
		const pendingToolCalls = new Map<string, ToolCall>(); // tools started, awaiting completion
		let usage = {
			inputTokens: 0,
			outputTokens: 0,
			costUsd: null as number | null,
		};

		try {
			for await (const event of parseClaudeStream(
				proc.stdout as ReadableStream<Uint8Array>,
			)) {
				// Check if MCP handler signaled termination
				if (this.shouldTerminate) {
					log.agent.debug(`[ClaudeCode] Terminal tool fired — killing process`);
					proc.kill("SIGTERM");
					break;
				}

				switch (event.type) {
					case "session_id": {
						ccSessionIds.set(this.session.id, event.sessionId);
						log.agent.info(
							`[ClaudeCode] Captured CC session ID: ${event.sessionId}`,
						);
						break;
					}

					case "text_delta": {
						currentSegmentBuffer += event.text;

						broadcast(
							createTurnMessageDeltaEvent({
								sessionId: this.session.id,
								turnId,
								segmentIndex: currentSegmentIndex,
								delta: event.text,
								contextType: this.session.contextType,
								contextId: this.session.contextId,
								agentRole: this.session.agentRole,
								pulseId: this.session.pulseId,
							}),
						);

						options.onMessageDelta?.(event.text);
						break;
					}

					case "thinking_delta": {
						options.onThoughtDelta?.(event.text);
						break;
					}

					case "tool_call_start": {
						// Track the tool name and start buffering input
						// Don't emit to UI yet — wait for tool_end when we have full input
						toolNames.set(event.toolCallId, event.toolName);
						toolInputBuffers.set(event.toolCallId, "");
						break;
					}

					case "tool_input_delta": {
						if (event.toolCallId) {
							const prev = toolInputBuffers.get(event.toolCallId) ?? "";
							toolInputBuffers.set(event.toolCallId, prev + event.partialJson);
						}
						break;
					}

					case "tool_call_end": {
						const toolName = toolNames.get(event.toolCallId);
						if (!toolName) break;

						// Skip internal CC tools
						if (IGNORED_TOOLS.has(toolName)) {
							toolNames.delete(event.toolCallId);
							toolInputBuffers.delete(event.toolCallId);
							break;
						}

						// Flush text segment before tool
						if (currentSegmentBuffer.length > 0) {
							await this.saveMessage(
								turnId,
								currentSegmentIndex,
								currentSegmentBuffer,
							);
							broadcast(
								createTurnSegmentCompleteEvent({
									sessionId: this.session.id,
									turnId,
									segmentIndex: currentSegmentIndex,
									content: currentSegmentBuffer,
								}),
							);
							currentSegmentIndex++;
							currentSegmentBuffer = "";
						}

						// Parse buffered input
						const inputJson = toolInputBuffers.get(event.toolCallId) ?? "";
						let parsedInput: unknown = {};
						if (inputJson.length > 0) {
							try {
								parsedInput = JSON.parse(inputJson);
							} catch {
								parsedInput = { raw: inputJson };
							}
						}

						// Strip mcp__autarch__ prefix for display
						const displayName = toolName.startsWith("mcp__autarch__")
							? toolName.slice("mcp__autarch__".length)
							: toolName;

						log.agent.debug(
							`[ClaudeCode] tool ready: ${displayName} inputLen=${inputJson.length}`,
						);

						// Record tool start with full input + reason
						// Status stays "running" until next message_start
						const toolCall = await this.recordToolStart(
							turnId,
							currentSegmentIndex,
							event.toolCallId,
							displayName,
							parsedInput,
						);
						pendingToolCalls.set(event.toolCallId, toolCall);
						options.onToolStarted?.(toolCall);

						toolNames.delete(event.toolCallId);
						toolInputBuffers.delete(event.toolCallId);
						currentSegmentIndex++;
						break;
					}

					case "content_block_end": {
						// Non-tool content block ended — no action needed
						break;
					}

					case "message_start": {
						// New LLM turn starting — all pending tools must have
						// finished executing (Claude Code waits for MCP results
						// before continuing). Complete them now.
						if (pendingToolCalls.size > 0) {
							log.agent.debug(
								`[ClaudeCode] message_start: completing ${pendingToolCalls.size} pending tool(s)`,
							);
							for (const [, toolCall] of pendingToolCalls) {
								await this.recordToolComplete(toolCall, "", true);
								options.onToolCompleted?.(toolCall);
							}
							pendingToolCalls.clear();
						}
						break;
					}

					case "result": {
						usage = {
							inputTokens: event.usage.input_tokens,
							outputTokens: event.usage.output_tokens,
							costUsd: event.costUsd,
						};
						break;
					}

					case "error": {
						log.agent.error(`[ClaudeCode] Stream error: ${event.message}`);
						break;
					}
				}
			}

			// Complete any remaining pending tools
			if (pendingToolCalls.size > 0) {
				log.agent.debug(
					`[ClaudeCode] Stream ended: completing ${pendingToolCalls.size} pending tool(s)`,
				);
				for (const [, toolCall] of pendingToolCalls) {
					await this.recordToolComplete(toolCall, "", true);
					options.onToolCompleted?.(toolCall);
				}
				pendingToolCalls.clear();
			}

			// Save remaining text
			if (currentSegmentBuffer.length > 0) {
				await this.saveMessage(
					turnId,
					currentSegmentIndex,
					currentSegmentBuffer,
				);
			}

			// Wait for process to exit
			await proc.exited;

			// Log any buffered text content on exit (helps debug when CC exits unexpectedly)
			if (proc.exitCode !== 0 && currentSegmentBuffer.trim()) {
				log.agent.debug(
					`[ClaudeCode] Buffered stdout at exit:\n${currentSegmentBuffer.slice(0, 1000)}`,
				);
			}

			// Always capture stderr (collected concurrently since spawn)
			const stderr = await stderrPromise;
			if (stderr.trim()) {
				const level =
					proc.exitCode !== 0 && !this.shouldTerminate ? "error" : "debug";
				if (level === "error") {
					log.agent.error(
						`[ClaudeCode] stderr (exit ${proc.exitCode}):\n${stderr.slice(0, 1000)}`,
					);
				} else {
					log.agent.debug(
						`[ClaudeCode] stderr (exit ${proc.exitCode}):\n${stderr.slice(0, 1000)}`,
					);
				}
			}

			// Throw on unexpected non-zero exit
			if (
				proc.exitCode !== 0 &&
				!this.shouldTerminate &&
				proc.exitCode !== null &&
				proc.exitCode !== 143
			) {
				throw new Error(
					`Claude Code exited with code ${proc.exitCode}: ${stderr.slice(0, 200)}`,
				);
			}
		} finally {
			signal?.removeEventListener("abort", abortHandler);
		}

		return usage;
	}
}
