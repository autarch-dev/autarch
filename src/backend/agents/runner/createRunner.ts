/**
 * Runner Factory
 *
 * Creates the appropriate IAgentRunner based on the configured backend.
 * Currently always returns the Vercel AI SDK-based AgentRunner.
 * Phase 4 will add ClaudeCodeRunner selection.
 */

import { AgentRunner } from "./AgentRunner";
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
	// Phase 4: backend selection based on getAgentBackend()
	// if (getAgentBackend() === "claude-code") {
	//   return new ClaudeCodeRunner(session, config);
	// }
	return new AgentRunner(session, config);
}
