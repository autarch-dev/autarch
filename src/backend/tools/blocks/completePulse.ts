/**
 * complete_pulse - Signal pulse completion with a summary
 */

import { z } from "zod";
import { getWorkflowOrchestrator } from "@/backend/agents/runner";
import { getChangedFiles } from "@/backend/git/commits";
import { log } from "@/backend/logger";
import { getRepositories } from "@/backend/repositories";
import type { VerificationCommand } from "@/backend/repositories/PulseRepository";
import { CompletionValidator } from "@/backend/services/pulsing/CompletionValidator";
import { OutputComparisonService } from "@/backend/services/pulsing/OutputComparison";
import { collectPartialOutput, dumpTimeoutLog } from "../base/timeoutLog";
import { getShellArgs } from "../pulsing/shell";
import type { ToolDefinition, ToolResult } from "../types";

// =============================================================================
// Scope-based filtering
// =============================================================================

/**
 * Filter verification commands to only those whose scope matches at least one changed file.
 * Commands without a scope always run (they apply to the entire project).
 */
function filterCommandsByScope(
	commands: VerificationCommand[],
	changedFiles: string[],
): { included: VerificationCommand[]; skipped: VerificationCommand[] } {
	const included: VerificationCommand[] = [];
	const skipped: VerificationCommand[] = [];

	for (const cmd of commands) {
		if (!cmd.scope) {
			included.push(cmd);
			continue;
		}

		const glob = new Bun.Glob(cmd.scope);
		const matches = changedFiles.some((file) => glob.match(file));
		if (matches) {
			included.push(cmd);
		} else {
			skipped.push(cmd);
		}
	}

	return { included, skipped };
}

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
			// Skip verification when the escape hatch was used — the agent has
			// acknowledged unresolved issues and verification failures are expected.
			const preflightSetup = await pulses.getPreflightSetup(pulse.workflowId);
			if (
				!hasUnresolvedIssues &&
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

				// Filter commands by scope based on which files the pulse changed
				let commandsToRun = preflightSetup.verificationCommands;
				const changedFiles = await getChangedFiles(worktreePath);
				if (changedFiles.length > 0) {
					const { included, skipped } = filterCommandsByScope(
						preflightSetup.verificationCommands,
						changedFiles,
					);
					for (const cmd of skipped) {
						log.workflow.info(
							`Skipping verification command '${cmd.command}' - no changed files in scope '${cmd.scope}'`,
						);
					}
					commandsToRun = included;
				}

				for (const verificationCmd of commandsToRun) {
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
							stdin: "ignore",
							stdout: "pipe",
							stderr: "pipe",
							env: process.env,
						});

						// Hoist output promises so partial output is accessible on timeout
						const stdoutPromise = new Response(proc.stdout).text();
						const stderrPromise = new Response(proc.stderr).text();
						const exitPromise = proc.exited;

						let timedOut = false;
						const timeoutPromise = new Promise<never>((_, reject) => {
							controller.signal.addEventListener("abort", () => {
								timedOut = true;
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
								Promise.all([stdoutPromise, stderrPromise, exitPromise]),
								timeoutPromise.then(() => {
									throw new Error("timeout");
								}),
							]);

							stdout = stdoutText;
							stderr = stderrText;
							exitCode = code;
						} catch (raceError) {
							if (timedOut) {
								const partial = await collectPartialOutput(
									stdoutPromise,
									stderrPromise,
								);
								await dumpTimeoutLog({
									projectRoot: context.projectRoot,
									label: "verification",
									command,
									timeoutSeconds: VERIFICATION_TIMEOUT / 1000,
									stdout: partial.stdout,
									stderr: partial.stderr,
								});
							}
							throw raceError;
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
							await validator.rejectCompletion(pulse.id);
							return {
								success: false,
								output: `No baseline recorded for command '${command}', run preflight first`,
							};
						}

						// Short-circuit: if both baseline and current exited 0, pass without LLM comparison
						if (baseline.exit_code === 0 && exitCode === 0) {
							log.workflow.info(
								`Verification command '${command}' passed (both exit code 0, skipping LLM comparison)`,
							);
							continue;
						}

						// Check combined output size against LLM context limits
						const combinedSize =
							baseline.stdout.length +
							baseline.stderr.length +
							stdout.length +
							stderr.length;
						if (combinedSize > 200000) {
							log.workflow.warn(
								`Output size exceeds LLM context limits for command '${command}' (${combinedSize} chars), skipping automatic comparison`,
							);
							await validator.rejectCompletion(pulse.id);
							return {
								success: false,
								output: [
									`Verification command '${command}' produced output too large for automatic analysis (${combinedSize} chars, limit 200000).`,
									`The command exited with code ${exitCode} (baseline was ${baseline.exit_code}).`,
									`Unable to compare outputs automatically. You should figure out why it's failing and fix it before running \`complete_pulse\` again.`,
								].join("\n"),
							};
						}

						// Compare outputs using two-tier comparison
						const comparison = await outputComparison.compareOutputs(
							pulse.workflowId,
							command,
							baseline,
							{ stdout, stderr, exit_code: exitCode },
						);

						if (
							!comparison.areEquivalent &&
							!comparison.isStrictlyImprovement
						) {
							// Log new issues for visibility
							log.workflow.error(
								`New issues detected for command '${command}':`,
								comparison.newIssues,
							);

							const issueDetails = comparison.newIssues
								.map((issue) => `- ${issue}`)
								.join("\n");

							await validator.rejectCompletion(pulse.id);
							return {
								success: false,
								output: `Verification failed with new issues:\n${issueDetails}`,
							};
						} else if (comparison.isStrictlyImprovement) {
							// Outputs are equivalent - continue to next command
							log.workflow.info(
								`Verification command '${command}' passed (LLM determined differences were strictly positive)`,
							);
						} else {
							// Outputs are equivalent - continue to next command
							log.workflow.info(
								`Verification command '${command}' passed (outputs equivalent)`,
							);
						}
					} catch (error) {
						const errorMessage =
							error instanceof Error ? error.message : "Unknown error";
						log.workflow.error(
							`Verification command failed for ${pulse.id}: ${errorMessage}`,
						);

						await validator.rejectCompletion(pulse.id);
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
