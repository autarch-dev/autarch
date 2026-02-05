/**
 * Centralized logging for the Autarch backend.
 *
 * Uses consola for colorful, structured terminal output.
 * Each module gets a scoped logger with its own tag.
 */

import { type ConsolaInstance, consola } from "consola";

// Configure the base logger
consola.options.formatOptions = {
	date: false, // Cleaner output without timestamps in dev
};

/**
 * Create a scoped logger for a specific module.
 */
export function createLogger(tag: string): ConsolaInstance {
	return consola.withTag(tag);
}

// Pre-configured loggers for core modules
export const log = {
	/** Server startup and lifecycle */
	server: createLogger("server"),

	/** Channel and session API routes */
	api: createLogger("api"),

	/** Session lifecycle management */
	session: createLogger("session"),

	/** Agent execution and LLM interactions */
	agent: createLogger("agent"),

	/** WebSocket connections and broadcasting */
	ws: createLogger("ws"),

	/** Tool execution */
	tools: createLogger("tools"),

	/** Embedding indexer and file watcher */
	embedding: createLogger("embedding"),

	/** Workflow orchestration */
	workflow: createLogger("workflow"),

	/** Git operations */
	git: createLogger("git"),

	/** Knowledge extraction and storage */
	knowledge: createLogger("knowledge"),
};
