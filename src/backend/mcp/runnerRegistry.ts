/**
 * Runner Registry
 *
 * Maps active session IDs to their ClaudeCodeRunner instances,
 * enabling the MCP handler to signal process termination when
 * terminal tools are called.
 */

import { log } from "@/backend/logger";

export interface KillableRunner {
	/** Signal the runner to terminate its subprocess after the current MCP response flushes */
	scheduleTermination(): void;
}

const registry = new Map<string, KillableRunner>();

/**
 * Register a runner for a session. Called by ClaudeCodeRunner before spawning `claude -p`.
 */
export function registerRunner(
	sessionId: string,
	runner: KillableRunner,
): void {
	registry.set(sessionId, runner);
}

/**
 * Deregister a runner. Called by ClaudeCodeRunner after the subprocess exits.
 */
export function deregisterRunner(sessionId: string): void {
	registry.delete(sessionId);
}

/**
 * Get the runner for a session. Used by the MCP handler to signal termination.
 */
export function getRunner(sessionId: string): KillableRunner | undefined {
	return registry.get(sessionId);
}

/**
 * Signal the runner to terminate after a terminal tool completes.
 * Returns true if the runner was found and signaled, false otherwise.
 */
export function signalTermination(sessionId: string): boolean {
	const runner = registry.get(sessionId);
	if (runner) {
		log.agent.info(
			`MCP handler signaling termination for session ${sessionId}`,
		);
		runner.scheduleTermination();
		return true;
	}
	log.agent.warn(
		`MCP handler tried to signal termination for unknown session ${sessionId}`,
	);
	return false;
}
