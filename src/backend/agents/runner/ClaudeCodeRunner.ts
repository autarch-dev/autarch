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
import type { RunOptions } from "./types";

// =============================================================================
// ClaudeCodeRunner
// =============================================================================

export class ClaudeCodeRunner
	extends BaseAgentRunner
	implements KillableRunner
{
	/** Claude Code session ID for --resume across nudge/continue calls */
	private ccSessionId: string | null = null;

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

				// Build CLI args
				const args = this.buildCliArgs(mcpConfigPath, promptPath, fullMessage);

				// Spawn claude -p
				const usage = await this.spawnAndStream(
					args,
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
		message: string,
	): string[] {
		const args = [
			"claude",
			"-p",
			"--bare",
			"--output-format",
			"stream-json",
			"--verbose",
			"--mcp-config",
			mcpConfigPath,
			"--append-system-prompt-file",
			promptPath,
			"--allowedTools",
			getAllowedTools(this.session.agentRole),
		];

		// Resume existing Claude Code session for nudge/continue
		if (this.ccSessionId) {
			args.push("--resume", this.ccSessionId);
		}

		// User message as positional argument
		args.push(message);

		return args;
	}

	// ===========================================================================
	// Subprocess Management & Stream Processing
	// ===========================================================================

	private async spawnAndStream(
		args: string[],
		turnId: string,
		options: RunOptions,
	): Promise<{
		inputTokens: number;
		outputTokens: number;
		costUsd: number | null;
	}> {
		const cwd = this.config.worktreePath ?? this.config.projectRoot;

		log.agent.debug(
			`[ClaudeCode] Spawning: ${args.slice(0, 5).join(" ")} ... (cwd: ${cwd})`,
		);

		const proc = Bun.spawn(args, {
			cwd,
			stdout: "pipe",
			stderr: "pipe",
			env: { ...process.env },
		});

		// Set up abort handling
		const signal = options.signal ?? this.session.abortController?.signal;
		const abortHandler = () => {
			log.agent.info(`[ClaudeCode] Abort signal received — killing process`);
			proc.kill("SIGTERM");
		};
		signal?.addEventListener("abort", abortHandler);

		// Track streaming state
		let currentSegmentBuffer = "";
		let currentSegmentIndex = 0;
		let activeToolCallId: string | null = null;
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
					log.agent.info(`[ClaudeCode] Terminal tool fired — killing process`);
					proc.kill("SIGTERM");
					break;
				}

				switch (event.type) {
					case "session_id": {
						this.ccSessionId = event.sessionId;
						log.agent.debug(
							`[ClaudeCode] Captured session ID: ${event.sessionId}`,
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

					case "tool_start": {
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

						activeToolCallId = event.toolCallId;

						// For native Claude Code tools (Read, Write, etc.), record in DB
						// MCP tools are recorded by the MCP handler
						if (!event.toolName.startsWith("mcp__")) {
							const toolCall = await this.recordToolStart(
								turnId,
								currentSegmentIndex,
								event.toolCallId,
								event.toolName,
								{},
							);
							options.onToolStarted?.(toolCall);
						}
						break;
					}

					case "tool_end":
					case "content_block_end": {
						if (activeToolCallId) {
							activeToolCallId = null;
							currentSegmentIndex++;
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

			if (proc.exitCode !== 0 && !this.shouldTerminate) {
				const stderr = await new Response(proc.stderr).text();
				if (stderr.trim()) {
					log.agent.error(`[ClaudeCode] stderr: ${stderr.slice(0, 500)}`);
				}
				// Don't throw on non-zero exit if we intentionally killed the process
				if (proc.exitCode !== null && proc.exitCode !== 143) {
					throw new Error(
						`Claude Code exited with code ${proc.exitCode}: ${stderr.slice(0, 200)}`,
					);
				}
			}
		} finally {
			signal?.removeEventListener("abort", abortHandler);
		}

		return usage;
	}
}
