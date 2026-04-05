/**
 * Claude Code Stream-JSON Parser
 *
 * Parses newline-delimited JSON from `claude -p --output-format stream-json --verbose`.
 *
 * Event types from Claude Code:
 * - stream_event: Raw Anthropic API streaming events (text deltas, tool_use, etc.)
 * - system: Session initialization, API retry info
 * - assistant: Complete assistant messages
 * - result: Final result with metadata (session_id, usage, cost)
 *
 * The stream_event.event field contains standard Anthropic API events:
 * - message_start, message_delta, message_stop
 * - content_block_start, content_block_delta, content_block_stop
 */

import { log } from "@/backend/logger";

// =============================================================================
// Types
// =============================================================================

/** Top-level event from Claude Code stream-json */
export interface StreamEvent {
	type: "stream_event";
	uuid: string;
	session_id: string;
	parent_tool_use_id: string | null;
	event: ApiEvent;
}

export interface SystemEvent {
	type: "system";
	subtype?: string;
	session_id?: string;
	[key: string]: unknown;
}

export interface AssistantEvent {
	type: "assistant";
	session_id: string;
	message: unknown;
}

export interface ResultEvent {
	type: "result";
	subtype: string;
	result: string;
	session_id: string;
	total_cost_usd: number | null;
	duration_ms: number;
	usage: {
		input_tokens: number;
		output_tokens: number;
	};
}

/** Anthropic API streaming event (nested inside stream_event) */
export type ApiEvent =
	| ContentBlockStartEvent
	| ContentBlockDeltaEvent
	| ContentBlockStopEvent
	| MessageStartEvent
	| MessageDeltaEvent
	| MessageStopEvent;

export interface ContentBlockStartEvent {
	type: "content_block_start";
	index: number;
	content_block: {
		type: "text" | "tool_use" | "thinking";
		id?: string;
		name?: string;
		text?: string;
		input?: Record<string, unknown>;
	};
}

export interface ContentBlockDeltaEvent {
	type: "content_block_delta";
	index: number;
	delta:
		| { type: "text_delta"; text: string }
		| { type: "input_json_delta"; partial_json: string }
		| { type: "thinking_delta"; thinking: string };
}

export interface ContentBlockStopEvent {
	type: "content_block_stop";
	index: number;
}

export interface MessageStartEvent {
	type: "message_start";
	message: unknown;
}

export interface MessageDeltaEvent {
	type: "message_delta";
	delta: { stop_reason?: string };
	usage?: { output_tokens: number };
}

export interface MessageStopEvent {
	type: "message_stop";
}

// =============================================================================
// Parsed events emitted to the runner
// =============================================================================

export type ParsedEvent =
	| { type: "session_id"; sessionId: string }
	| { type: "text_delta"; text: string }
	| { type: "thinking_delta"; text: string }
	| { type: "tool_start"; toolCallId: string; toolName: string }
	| { type: "tool_input_delta"; toolCallId: string; partialJson: string }
	| { type: "tool_end"; toolCallId: string }
	| { type: "content_block_end"; index: number }
	| {
			type: "result";
			sessionId: string;
			usage: { input_tokens: number; output_tokens: number };
			costUsd: number | null;
	  }
	| { type: "error"; message: string };

// =============================================================================
// Parser
// =============================================================================

/**
 * Parse a stream of Claude Code stream-json output into typed events.
 *
 * Reads from a ReadableStream (stdout of Bun.spawn), splits by newlines,
 * parses JSON, and yields typed ParsedEvent objects.
 */
export async function* parseClaudeStream(
	stdout: ReadableStream<Uint8Array>,
): AsyncGenerator<ParsedEvent> {
	const reader = stdout.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	let sessionIdEmitted = false;
	let hasSeenStreamEvents = false;

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			buffer += decoder.decode(value, { stream: true });

			// Process complete lines
			for (
				let newlineIdx = buffer.indexOf("\n");
				newlineIdx !== -1;
				newlineIdx = buffer.indexOf("\n")
			) {
				const line = buffer.slice(0, newlineIdx).trim();
				buffer = buffer.slice(newlineIdx + 1);

				if (line.length === 0) continue;

				let parsed: unknown;
				try {
					parsed = JSON.parse(line);
				} catch {
					log.agent.warn(
						`Failed to parse stream-json line: ${line.slice(0, 100)}`,
					);
					continue;
				}

				const event = parsed as Record<string, unknown>;

				// Emit session_id from the first event that has one
				if (!sessionIdEmitted && typeof event.session_id === "string") {
					yield { type: "session_id", sessionId: event.session_id };
					sessionIdEmitted = true;
				}

				if (event.type === "stream_event") {
					hasSeenStreamEvents = true;
					yield* processStreamEvent(event as unknown as StreamEvent);
				} else if (event.type === "assistant") {
					// Skip assistant message if we already got streaming deltas
					// (with --include-partial-messages, both are emitted — avoid double-counting)
					if (hasSeenStreamEvents) break;
					yield* processAssistantMessage(event as unknown as AssistantEvent);
				} else if (event.type === "result") {
					const result = event as unknown as ResultEvent;
					yield {
						type: "result",
						sessionId: result.session_id,
						usage: result.usage,
						costUsd: result.total_cost_usd,
					};
				} else if (
					event.type === "system" &&
					(event as SystemEvent).subtype === "error"
				) {
					yield {
						type: "error",
						message: String(
							(event as SystemEvent).error ?? "Unknown system error",
						),
					};
				}
			}
		}
	} finally {
		reader.releaseLock();
	}
}

/**
 * Process a stream_event (wraps Anthropic API events).
 */
function* processStreamEvent(event: StreamEvent): Generator<ParsedEvent> {
	const apiEvent = event.event;
	if (!apiEvent?.type) return;

	switch (apiEvent.type) {
		case "content_block_start": {
			const block = apiEvent.content_block;
			if (block.type === "tool_use" && block.id && block.name) {
				yield {
					type: "tool_start",
					toolCallId: block.id,
					toolName: block.name,
				};
			}
			break;
		}

		case "content_block_delta": {
			const delta = apiEvent.delta;
			if (delta.type === "text_delta") {
				yield { type: "text_delta", text: delta.text };
			} else if (delta.type === "input_json_delta") {
				// Tool input is being streamed — buffer it.
				// The MCP handler will receive the complete input when the tool executes.
				// We emit this for potential future use (progress indication).
				yield {
					type: "tool_input_delta",
					toolCallId: "", // Not available in delta events
					partialJson: delta.partial_json,
				};
			} else if (delta.type === "thinking_delta") {
				yield { type: "thinking_delta", text: delta.thinking };
			}
			break;
		}

		case "content_block_stop": {
			yield { type: "content_block_end", index: apiEvent.index };
			break;
		}

		// message_start, message_delta, message_stop — no action needed
		// (session_id is captured from top-level, usage from result event)
	}
}

/**
 * Process an assistant message (complete, non-streaming).
 * Emitted by Claude Code when --include-partial-messages is not set.
 * Extract text and tool_use blocks from the message content.
 */
function* processAssistantMessage(
	event: AssistantEvent,
): Generator<ParsedEvent> {
	const msg = event.message as {
		content?: Array<{
			type: string;
			text?: string;
			id?: string;
			name?: string;
			input?: unknown;
		}>;
	};

	if (!msg?.content || !Array.isArray(msg.content)) return;

	for (const block of msg.content) {
		if (block.type === "text" && block.text) {
			yield { type: "text_delta", text: block.text };
		} else if (block.type === "tool_use" && block.id && block.name) {
			yield {
				type: "tool_start",
				toolCallId: block.id,
				toolName: block.name,
			};
			yield { type: "tool_end", toolCallId: block.id };
		}
	}
}
