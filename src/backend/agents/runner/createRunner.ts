/**
 * Runner Factory
 *
 * Creates the appropriate IAgentRunner based on the configured backend.
 * The backend is a user-chosen setting (defaults to "api").
 */

import { getAgentBackend } from "@/backend/services/globalSettings";
import { AgentRunner } from "./AgentRunner";
import { ClaudeCodeRunner } from "./ClaudeCodeRunner";
import type { IAgentRunner } from "./IAgentRunner";
import type { ActiveSession, RunnerConfig } from "./types";

/**
 * Create an agent runner for the given session and config.
 *
 * All callsites should use this factory instead of `new AgentRunner(...)` directly.
 */
export function createRunner(
	session: ActiveSession,
	config: RunnerConfig,
): IAgentRunner {
	if (getAgentBackend() === "claude-code") {
		return new ClaudeCodeRunner(session, config);
	}
	return new AgentRunner(session, config);
}
