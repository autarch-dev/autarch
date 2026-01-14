/**
 * StreamHandler - Processes LLM stream chunks
 *
 * Handles parsing of streaming responses from different LLM providers:
 * - Anthropic (Claude)
 * - OpenAI (GPT)
 * - Google (Gemini)
 * - xAI (Grok)
 *
 * Responsibilities:
 * - Parse provider-specific stream formats
 * - Extract text deltas, tool calls, and thinking blocks
 * - Accumulate content for persistence
 * - Emit events for real-time UI updates
 */

import type { AIProvider } from "@/shared/schemas/settings";

// =============================================================================
// Types
// =============================================================================

export type StreamEventType =
	| "text_delta"
	| "thinking_delta"
	| "tool_use_start"
	| "tool_use_delta"
	| "tool_use_end"
	| "message_start"
	| "message_end"
	| "error";

export interface StreamEvent {
	type: StreamEventType;
	data: unknown;
}

export interface TextDeltaEvent extends StreamEvent {
	type: "text_delta";
	data: { delta: string };
}

export interface ThinkingDeltaEvent extends StreamEvent {
	type: "thinking_delta";
	data: { delta: string };
}

export interface ToolUseStartEvent extends StreamEvent {
	type: "tool_use_start";
	data: { id: string; name: string };
}

export interface ToolUseDeltaEvent extends StreamEvent {
	type: "tool_use_delta";
	data: { id: string; delta: string };
}

export interface ToolUseEndEvent extends StreamEvent {
	type: "tool_use_end";
	data: { id: string; input: unknown };
}

export interface StreamHandlerCallbacks {
	onTextDelta?: (delta: string) => void;
	onThinkingDelta?: (delta: string) => void;
	onToolUseStart?: (id: string, name: string) => void;
	onToolUseDelta?: (id: string, delta: string) => void;
	onToolUseEnd?: (id: string, input: unknown) => void;
	onError?: (error: Error) => void;
}

// =============================================================================
// StreamHandler
// =============================================================================

export class StreamHandler {
	private provider: AIProvider;
	private callbacks: StreamHandlerCallbacks;
	private textBuffer = "";
	private thinkingBuffer = "";
	private toolInputBuffers = new Map<string, string>();

	constructor(provider: AIProvider, callbacks: StreamHandlerCallbacks = {}) {
		this.provider = provider;
		this.callbacks = callbacks;
	}

	/**
	 * Process a stream chunk from the LLM provider
	 *
	 * TODO: Implement actual parsing for each provider's stream format
	 */
	processChunk(chunk: unknown): StreamEvent[] {
		switch (this.provider) {
			case "anthropic":
				return this.processAnthropicChunk(chunk);
			case "openai":
				return this.processOpenAIChunk(chunk);
			case "google":
				return this.processGoogleChunk(chunk);
			case "xai":
				return this.processXAIChunk(chunk);
			default:
				return [];
		}
	}

	/**
	 * Get accumulated text content
	 */
	getText(): string {
		return this.textBuffer;
	}

	/**
	 * Get accumulated thinking content
	 */
	getThinking(): string {
		return this.thinkingBuffer;
	}

	/**
	 * Reset all buffers
	 */
	reset(): void {
		this.textBuffer = "";
		this.thinkingBuffer = "";
		this.toolInputBuffers.clear();
	}

	// ===========================================================================
	// Provider-Specific Parsing (Stubs)
	// ===========================================================================

	/**
	 * Parse Anthropic streaming format
	 *
	 * Anthropic uses Server-Sent Events with these event types:
	 * - message_start: Beginning of message
	 * - content_block_start: Start of text/tool_use block
	 * - content_block_delta: Text or tool input delta
	 * - content_block_stop: End of block
	 * - message_delta: Usage stats
	 * - message_stop: End of message
	 *
	 * TODO: Implement actual parsing
	 */
	private processAnthropicChunk(_chunk: unknown): StreamEvent[] {
		// Stub - actual implementation will parse Anthropic SSE format
		return [];
	}

	/**
	 * Parse OpenAI streaming format
	 *
	 * OpenAI uses Server-Sent Events with these fields:
	 * - choices[].delta.content: Text delta
	 * - choices[].delta.tool_calls: Tool call deltas
	 * - choices[].finish_reason: Completion reason
	 *
	 * TODO: Implement actual parsing
	 */
	private processOpenAIChunk(_chunk: unknown): StreamEvent[] {
		// Stub - actual implementation will parse OpenAI SSE format
		return [];
	}

	/**
	 * Parse Google Gemini streaming format
	 *
	 * Gemini uses a different streaming format with:
	 * - candidates[].content.parts[]: Content parts
	 * - candidates[].finishReason: Completion reason
	 *
	 * TODO: Implement actual parsing
	 */
	private processGoogleChunk(_chunk: unknown): StreamEvent[] {
		// Stub - actual implementation will parse Gemini format
		return [];
	}

	/**
	 * Parse xAI Grok streaming format
	 *
	 * xAI uses OpenAI-compatible format
	 *
	 * TODO: Implement actual parsing
	 */
	private processXAIChunk(_chunk: unknown): StreamEvent[] {
		// Stub - actual implementation will parse xAI format (OpenAI-compatible)
		return [];
	}

	// ===========================================================================
	// Helper Methods
	// ===========================================================================

	private emitTextDelta(delta: string): void {
		this.textBuffer += delta;
		this.callbacks.onTextDelta?.(delta);
	}

	private emitThinkingDelta(delta: string): void {
		this.thinkingBuffer += delta;
		this.callbacks.onThinkingDelta?.(delta);
	}

	private emitToolUseStart(id: string, name: string): void {
		this.toolInputBuffers.set(id, "");
		this.callbacks.onToolUseStart?.(id, name);
	}

	private emitToolUseDelta(id: string, delta: string): void {
		const current = this.toolInputBuffers.get(id) ?? "";
		this.toolInputBuffers.set(id, current + delta);
		this.callbacks.onToolUseDelta?.(id, delta);
	}

	private emitToolUseEnd(id: string): void {
		const inputStr = this.toolInputBuffers.get(id) ?? "{}";
		let input: unknown;
		try {
			input = JSON.parse(inputStr);
		} catch {
			input = { raw: inputStr };
		}
		this.callbacks.onToolUseEnd?.(id, input);
	}
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a StreamHandler for the given provider
 */
export function createStreamHandler(
	provider: AIProvider,
	callbacks?: StreamHandlerCallbacks,
): StreamHandler {
	return new StreamHandler(provider, callbacks);
}
