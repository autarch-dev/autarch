/**
 * Mock PulseOrchestrator
 *
 * Exports:
 * - createMockPulseOrchestrator() — factory returning a fresh mock instance
 * - mockPulseOrchestratorInstance — module-level reference tests can reconfigure
 * - MockPulseOrchestratorClass — constructor function for mock.module()
 */

import { mock } from "bun:test";
import { createMockPulse } from "./fixtures";

export function createMockPulseOrchestrator() {
	return {
		initializePulsing: mock(() =>
			Promise.resolve({
				success: true,
				workflowBranch: "workflow/wf-1",
				worktreePath: "/mock/worktree",
			}),
		),
		createPulsesFromPlan: mock(() => Promise.resolve([])),
		createPreflightSetup: mock(() =>
			Promise.resolve({
				id: "preflight-1",
				workflowId: "wf-1",
				status: "running" as const,
				createdAt: Date.now(),
			}),
		),
		startNextPulse: mock(() => Promise.resolve(createMockPulse())),
		getRunningPulse: mock(() => Promise.resolve(createMockPulse())),
		completePulse: mock(() =>
			Promise.resolve({ success: true, hasMorePulses: false }),
		),
		failPulse: mock(() => Promise.resolve()),
		stopPulse: mock(() => Promise.resolve()),
		isPreflightComplete: mock(() => Promise.resolve(true)),
		isPreflightFailed: mock(() => Promise.resolve(false)),
		incrementRejectionCount: mock(() => Promise.resolve(0)),
		getRejectionCount: mock(() => Promise.resolve(0)),
		getPulses: mock(() => Promise.resolve([])),
		areAllPulsesComplete: mock(() => Promise.resolve(true)),
		hasUnresolvedIssues: mock(() => Promise.resolve(false)),
	};
}

/**
 * Module-level mock instance that tests can reconfigure between test cases.
 * Reset in beforeEach by calling createMockPulseOrchestrator() and reassigning fields.
 */
export const mockPulseOrchestratorInstance = createMockPulseOrchestrator();

/**
 * Reset the module-level instance with fresh mocks.
 * Call this in beforeEach to prevent cross-test contamination.
 */
export function resetMockPulseOrchestrator() {
	const fresh = createMockPulseOrchestrator();
	for (const key of Object.keys(fresh) as Array<
		keyof ReturnType<typeof createMockPulseOrchestrator>
	>) {
		(mockPulseOrchestratorInstance as Record<string, unknown>)[key] =
			fresh[key];
	}
}

/**
 * Constructor function that returns the module-level mock instance.
 * Use with mock.module() to intercept `new PulseOrchestrator(config)`.
 */
export const MockPulseOrchestratorClass = mock(
	() => mockPulseOrchestratorInstance,
);
