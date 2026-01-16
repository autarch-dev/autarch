/**
 * CompletionValidator - Validates pulse completion and manages escape hatch
 *
 * Implements the completion protocol from pulse-agent.md:
 * 1. Scan recent messages for tool failures (non-zero exit codes, errors)
 * 2. Track rejection count per pulse
 * 3. Progressive rejection: first N attempts must fix issues
 * 4. After threshold, reveal unresolvedIssues escape hatch
 */

import { log } from "@/backend/logger";
import type { ConversationRepository } from "@/backend/repositories/ConversationRepository";
import type { PulseRepository } from "@/backend/repositories/PulseRepository";

// =============================================================================
// Constants
// =============================================================================

/** Number of rejections before revealing escape hatch */
const ESCAPE_HATCH_THRESHOLD = 2;

/** Tool names that indicate failures when their output contains errors */
const FAILURE_TOOLS = ["shell", "edit_file", "multi_edit", "write_file"];

// =============================================================================
// Types
// =============================================================================

export interface ValidationResult {
	valid: boolean;
	/** If not valid, the reason for rejection */
	rejectionReason?: string;
	/** If escape hatch is available */
	escapeHatchAvailable: boolean;
	/** List of detected failures */
	failures: ToolFailure[];
}

export interface ToolFailure {
	toolName: string;
	reason: string;
	turnId: string;
}

// =============================================================================
// CompletionValidator
// =============================================================================

export class CompletionValidator {
	constructor(
		private conversationRepo: ConversationRepository,
		private pulseRepo: PulseRepository,
	) {}

	/**
	 * Validate pulse completion
	 *
	 * Checks for tool failures in recent turns and determines if:
	 * - Completion should be accepted
	 * - Completion should be rejected (agent must fix issues)
	 * - Escape hatch should be offered
	 *
	 * @param pulseId - The pulse ID
	 * @param sessionId - The session ID for the pulse
	 * @param hasUnresolvedIssues - Whether the agent declared unresolved issues
	 */
	async validateCompletion(
		pulseId: string,
		sessionId: string,
		hasUnresolvedIssues: boolean,
	): Promise<ValidationResult> {
		// Get rejection count
		const pulse = await this.pulseRepo.getPulse(pulseId);
		if (!pulse) {
			return {
				valid: false,
				rejectionReason: "Pulse not found",
				escapeHatchAvailable: false,
				failures: [],
			};
		}

		const rejectionCount = pulse.rejectionCount;
		const escapeHatchAvailable = rejectionCount >= ESCAPE_HATCH_THRESHOLD;

		// If agent declared unresolved issues
		if (hasUnresolvedIssues) {
			if (escapeHatchAvailable) {
				// Accept with unresolved issues (will halt orchestration)
				log.workflow.info(
					`Pulse ${pulseId} completed with acknowledged unresolved issues`,
				);
				return {
					valid: true,
					escapeHatchAvailable: true,
					failures: [],
				};
			}
			// Reject - can't use escape hatch yet
			return {
				valid: false,
				rejectionReason:
					"Cannot acknowledge unresolved issues yet. Please fix the issues first.",
				escapeHatchAvailable: false,
				failures: [],
			};
		}

		// Check for tool failures
		const failures = await this.detectToolFailures(sessionId);

		if (failures.length === 0) {
			// No failures, accept completion
			return {
				valid: true,
				escapeHatchAvailable,
				failures: [],
			};
		}

		// Has failures - build rejection message
		const failureList = failures
			.map((f) => `- ${f.toolName}: ${f.reason}`)
			.join("\n");

		let rejectionReason = `Cannot complete pulse: there are unresolved tool failures:\n\n${failureList}\n\nPlease fix these issues before calling complete_pulse.`;

		if (escapeHatchAvailable) {
			rejectionReason +=
				"\n\nAlternatively, if these issues genuinely cannot be fixed (e.g., pre-existing flaky tests), you may use the unresolvedIssues parameter to acknowledge them.";
		}

		return {
			valid: false,
			rejectionReason,
			escapeHatchAvailable,
			failures,
		};
	}

	/**
	 * Detect tool failures in the session
	 *
	 * Looks at recent tool calls to find:
	 * - Shell commands with non-zero exit codes
	 * - Edit operations that failed
	 * - Any tool that returned success: false
	 */
	private async detectToolFailures(sessionId: string): Promise<ToolFailure[]> {
		const failures: ToolFailure[] = [];

		try {
			// Get all turns for this session
			const { turns } =
				await this.conversationRepo.loadSessionContext(sessionId);

			// Look at recent assistant turns (last 5)
			const recentTurns = turns.filter((t) => t.role === "assistant").slice(-5);

			for (const turn of recentTurns) {
				// Get tools for this turn
				const tools = await this.conversationRepo.getTools(turn.id);

				for (const tool of tools) {
					if (!FAILURE_TOOLS.includes(tool.tool_name)) {
						continue;
					}

					// Check if tool has output and if it indicates failure
					if (!tool.output_json) {
						continue;
					}

					try {
						const output = JSON.parse(tool.output_json);

						// Check for explicit failure
						if (output.success === false) {
							failures.push({
								toolName: tool.tool_name,
								reason: output.error || "Tool returned failure",
								turnId: turn.id,
							});
							continue;
						}

						// Check shell exit code
						if (tool.tool_name === "shell" && output.exitCode !== 0) {
							failures.push({
								toolName: "shell",
								reason: `Exit code ${output.exitCode}`,
								turnId: turn.id,
							});
						}
					} catch {
						// Couldn't parse output, skip
					}
				}
			}
		} catch (error) {
			log.workflow.error(`Failed to detect tool failures: ${error}`);
		}

		return failures;
	}

	/**
	 * Increment rejection count and return validation message
	 */
	async rejectCompletion(pulseId: string): Promise<number> {
		return this.pulseRepo.incrementRejectionCount(pulseId);
	}
}
