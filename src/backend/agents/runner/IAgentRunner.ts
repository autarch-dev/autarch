/**
 * IAgentRunner - Interface for agent execution backends
 *
 * All agent runners (API-based, Claude Code CLI, etc.) implement this interface.
 * The only public method is run() — all 19 callsites use this identical contract.
 */

import type { RunOptions } from "./types";

export interface IAgentRunner {
	run(
		userMessage: string,
		options?: RunOptions,
		nudgeCount?: number,
		cacheUserMessage?: boolean,
	): Promise<void>;
}
