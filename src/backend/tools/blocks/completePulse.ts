/**
 * complete_pulse - Signal pulse completion with a summary
 */

import { z } from "zod";
import { getWorkflowOrchestrator } from "@/backend/agents/runner";
import { log } from "@/backend/logger";
import { getRepositories } from "@/backend/repositories";
import { CompletionValidator } from "@/backend/services/pulsing/CompletionValidator";
import { OutputComparisonService } from "@/backend/services/pulsing/OutputComparison";
import { getShellArgs } from "../pulsing/shell";
import type { ToolDefinition, ToolResult } from "../types";

// =============================================================================
// Schema
// =============================================================================

const unresolvedIssueSchema = z.object({
	issue: z.string().describe("Description of the issue"),
	reason: z.string().describe("Why this issue cannot be fixed"),
});

export const completePulseInputSchema = z.object({
	summary: z
		.string()
		.describe(
			'Conventional commit message (e.g., "feat(auth): implement login flow")',
		),
	unresolvedIssues: z
		.array(unresolvedIssueSchema)
		.optional()
		.describe(
			"Acknowledged issues that couldn't be fixed (escape hatch). Only use after attempts to fix have failed.",
		),
});

export type CompletePulseInput = z.infer<typeof completePulseInputSchema>;

// =============================================================================
// Tool Definition
// =============================================================================

export const completePulseTool: ToolDefinition<CompletePulseInput> = {
	name: "complete_pulse",
	description: `Signal pulse completion with a summary suitable for commit message.
Only use when ALL pulse requirements are satisfied — code complete and clean.
The summary field becomes the commit message. Format it as a Conventional Commit.

If you encounter issues you genuinely cannot fix (e.g., pre-existing flaky tests),
you may use unresolvedIssues after multiple attempts. This will halt automatic
orchestration for human review.`,
	inputSchema: completePulseInputSchema,
	execute: async (input, context): Promise<ToolResult> => {
		// Validate we have required context
		if (!context.workflowId) {
			return {
				success: false,
				output: "Error: complete_pulse requires a workflow context",
			};
		}

		if (!context.sessionId) {
			return {
				success: false,
				output: "Error: complete_pulse requires a session context",
			};
		}

		try {
			const { pulses, conversations } = getRepositories();

			// Get the running pulse for this workflow
			const pulse = await pulses.getRunningPulse(context.workflowId);
			if (!pulse) {
				return {
					success: false,
					output: "Error: No running pulse found for this workflow",
				};
			}

			// Create validator and validate completion
			const validator = new CompletionValidator(conversations, pulses);
			const hasUnresolvedIssues =
				input.unresolvedIssues && input.unresolvedIssues.length > 0;

			const validation = await validator.validateCompletion(
				pulse.id,
				context.sessionId,
				hasUnresolvedIssues ?? false,
			);

			if (!validation.valid) {
				// Increment rejection count
				await validator.rejectCompletion(pulse.id);

				log.workflow.info(
					`Pulse completion rejected for ${pulse.id}: ${validation.rejectionReason}`,
				);

				return {
					success: false,
					output: `Error: ${validation.rejectionReason}`,
				};
			}

			// Validation passed - commit and merge the changes
			log.workflow.info(
				`Pulse completion validated for ${pulse.id}: ${input.summary}`,
			);

			// Execute verification commands if configured
			const preflightSetup = await pulses.getPreflightSetup(pulse.workflowId);
			if (
				preflightSetup?.verificationCommands &&
				preflightSetup.verificationCommands.length > 0
			) {
				if (!pulse.worktreePath) {
					return {
						success: false,
						output:
							"Error: Cannot run verification commands - pulse has no worktree path",
					};
				}

				const outputComparison = new OutputComparisonService();
				const VERIFICATION_TIMEOUT = 300 * 1000; // 300 seconds
				const worktreePath = pulse.worktreePath; // Capture for use in loop

				for (const verificationCmd of preflightSetup.verificationCommands) {
					const { command, source } = verificationCmd;
					log.workflow.info(
						`Running verification command for ${pulse.id}: ${command} (source: ${source})`,
					);

					try {
						// Create abort controller for timeout
						const controller = new AbortController();
						const timeoutId = setTimeout(
							() => controller.abort(),
							VERIFICATION_TIMEOUT,
						);

						// Spawn the process
						const proc = Bun.spawn(getShellArgs(command), {
							cwd: worktreePath,
							stdout: "pipe",
							stderr: "pipe",
							env: process.env,
						});

						// Wait for process with timeout
						const exitPromise = proc.exited;
						const timeoutPromise = new Promise<never>((_, reject) => {
							controller.signal.addEventListener("abort", () => {
								proc.kill();
								reject(
									new Error(
										`Verification command timed out after 300 seconds: ${command}`,
									),
								);
							});
						});

						let stdout: string;
						let stderr: string;
						let exitCode: number;

						try {
							const [stdoutText, stderrText, code] = await Promise.race([
								Promise.all([
									new Response(proc.stdout).text(),
									new Response(proc.stderr).text(),
									exitPromise,
								]),
								timeoutPromise.then(() => {
									throw new Error("timeout");
								}),
							]);

							stdout = stdoutText;
							stderr = stderrText;
							exitCode = code;
						} finally {
							clearTimeout(timeoutId);
						}

						// Retrieve baseline for this command
						const baseline = await pulses.getCommandBaseline(
							pulse.workflowId,
							command,
						);

						if (baseline === null) {
							log.workflow.error(
								`No baseline recorded for command '${command}', run preflight first`,
							);
							return {
								success: false,
								output: `No baseline recorded for command '${command}', run preflight first`,
							};
						}

						// Check combined output size against LLM context limits
						const combinedSize =
							baseline.stdout.length +
							baseline.stderr.length +
							stdout.length +
							stderr.length;
						if (combinedSize > 100000) {
							log.workflow.error(
								`Output size exceeds LLM context limits for command '${command}'`,
							);
							return {
								success: false,
								output: `Output size exceeds LLM context limits for command '${command}'`,
							};
						}

						// Compare outputs using two-tier comparison
						const comparison = await outputComparison.compareOutputs(
							pulse.workflowId,
							baseline,
							{ stdout, stderr, exit_code: exitCode },
						);

						if (!comparison.areEquivalent) {
							// Log new issues for visibility
							log.workflow.error(
								`New issues detected for command '${command}':`,
								comparison.newIssues,
							);

							const issueDetails = comparison.newIssues
								.map((issue) => `- ${issue}`)
								.join("\n");

							return {
								success: false,
								output: `Verification failed with new issues:\n${issueDetails}`,
							};
						}

						// Outputs are equivalent - continue to next command
						log.workflow.info(
							`Verification command '${command}' passed (outputs equivalent)`,
						);
					} catch (error) {
						const errorMessage =
							error instanceof Error ? error.message : "Unknown error";
						log.workflow.error(
							`Verification command failed for ${pulse.id}: ${errorMessage}`,
						);

						return {
							success: false,
							output: `Verification failed: ${errorMessage}`,
						};
					}
				}

				log.workflow.info(`All verification commands passed for ${pulse.id}`);
			}

			// Commit and merge the pulse changes
			// Note: Session transition to next pulse is handled by AgentRunner
			// after this turn completes (via handleTurnCompletion)
			const pulseOrchestrator =
				getWorkflowOrchestrator().getPulseOrchestrator();
			const result = await pulseOrchestrator.completePulse(
				pulse.id,
				input.summary,
				hasUnresolvedIssues ?? false,
			);

			if (!result.success) {
				return {
					success: false,
					output: `Error: ${result.error ?? "Failed to complete pulse"}`,
				};
			}

			const lines = [
				"Pulse completed. Changes committed and merged.",
				`Commit message: ${input.summary}`,
				"Wait for the user to respond.",
			];
			if (hasUnresolvedIssues) {
				lines.push(
					`Warning: ${input.unresolvedIssues?.length} unresolved issue(s) acknowledged. Orchestration halted for review.`,
				);
			}

			return {
				success: true,
				output: lines.join("\n"),
			};
		} catch (error) {
			return {
				success: false,
				output: `Error: ${error instanceof Error ? error.message : "Failed to complete pulse"}`,
			};
		}
	},
};
