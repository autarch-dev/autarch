/**
 * Mock AgentRunner
 *
 * Exports:
 * - mockAgentRunnerRun — mock for the run() method
 * - MockAgentRunnerClass — class constructor for mock.module()
 * - getLastAgentRunnerInstance() — inspect constructor args from last instantiation
 */

import { mock } from "bun:test";

/** Mock for AgentRunner.prototype.run() */
export const mockAgentRunnerRun = mock(() => Promise.resolve());

/** Stores the most recently constructed AgentRunner instance args */
let lastInstance: { session: unknown; config: unknown } | null = null;

/** Tracks how many times the constructor has been called */
let constructorCallCount = 0;

/**
 * Mock class for AgentRunner.
 * Captures constructor arguments and assigns the shared mockAgentRunnerRun.
 * Uses a real class so `new` works correctly with bun's mock.module.
 */
export class MockAgentRunnerClass {
	session: unknown;
	config: unknown;
	run = mockAgentRunnerRun;

	constructor(session: unknown, config: unknown) {
		this.session = session;
		this.config = config;
		lastInstance = { session, config };
		constructorCallCount++;
	}
}

/**
 * Returns the constructor arguments from the last AgentRunner instantiation.
 * Useful for verifying the session and config passed to the runner.
 */
export function getLastAgentRunnerInstance() {
	return lastInstance;
}

/**
 * Returns how many times the MockAgentRunnerClass constructor was called.
 */
export function getAgentRunnerConstructorCallCount() {
	return constructorCallCount;
}

/**
 * Reset the mock state. Call in beforeEach.
 */
export function resetMockAgentRunner() {
	mockAgentRunnerRun.mockClear();
	lastInstance = null;
	constructorCallCount = 0;
}
