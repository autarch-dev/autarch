/**
 * Mock AgentRunner
 *
 * Exports:
 * - mockAgentRunnerRun — mock for the run() method
 * - MockAgentRunnerClass — constructor that captures args and wires run()
 * - getLastAgentRunnerInstance() — inspect constructor args from last instantiation
 */

import { mock } from "bun:test";

/** Mock for AgentRunner.prototype.run() */
export const mockAgentRunnerRun = mock(() => Promise.resolve());

/** Stores the most recently constructed AgentRunner instance args */
let lastInstance: { session: unknown; config: unknown } | null = null;

/**
 * Mock constructor for AgentRunner.
 * Captures constructor arguments and assigns the shared mockAgentRunnerRun.
 */
export const MockAgentRunnerClass = mock(function (
	this: { run: typeof mockAgentRunnerRun; session: unknown; config: unknown },
	session: unknown,
	config: unknown,
) {
	this.session = session;
	this.config = config;
	this.run = mockAgentRunnerRun;
	lastInstance = { session, config };
});

/**
 * Returns the constructor arguments from the last AgentRunner instantiation.
 * Useful for verifying the session and config passed to the runner.
 */
export function getLastAgentRunnerInstance() {
	return lastInstance;
}

/**
 * Reset the mock state. Call in beforeEach.
 */
export function resetMockAgentRunner() {
	mockAgentRunnerRun.mockClear();
	MockAgentRunnerClass.mockClear();
	lastInstance = null;
}
