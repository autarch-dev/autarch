/**
 * Mock SessionManager factory
 *
 * Returns an object with all SessionManager public methods as mocks.
 * Default behavior: startSession and getOrRestoreSession return a
 * default ActiveSession; other methods resolve to undefined.
 */

import { mock } from "bun:test";
import { createMockActiveSession } from "./fixtures";

export function createMockSessionManager() {
	return {
		startSession: mock(() => Promise.resolve(createMockActiveSession())),
		stopSession: mock(() => Promise.resolve(undefined)),
		errorSession: mock(() => Promise.resolve(undefined)),
		getOrRestoreSession: mock(() => Promise.resolve(createMockActiveSession())),
		getActiveSession: mock(() => createMockActiveSession()),
		isSessionActive: mock(() => true),
		getAllActiveSessions: mock(() => []),
		cleanup: mock(() => Promise.resolve(undefined)),
	};
}
