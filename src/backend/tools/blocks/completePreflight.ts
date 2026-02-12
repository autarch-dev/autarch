/**
 * complete_preflight - Signal preflight environment setup is complete
 */

import { z } from "zod";
import { log } from "@/backend/logger";
import { getRepositories } from "@/backend/repositories";
import { broadcast } from "@/backend/ws";
import { createPreflightCompletedEvent } from "@/shared/schemas/events";
import { getShellArgs } from "../pulsing/shell";
import type { ToolDefinition, ToolResult } from "../types";

// =============================================================================
// Schema
// =============================================================================

const verificationCommandSchema = z.object({
	command: z.string().describe("The shell command to run"),
	source: z
		.enum(["build", "lint", "test"])
		.describe("The type of verification (for baseline filtering)"),
});

export const completePreflightInputSchema = z.object({
	summary: z.string().describe("Brief description of setup completed"),
	setupCommands: z
		.array(z.string())
		.describe("List of commands that were executed"),
	buildSuccess: z.boolean().describe("Whether the project builds successfully"),
	baselinesRecorded: z.number().describe("Count of baseline issues recorded"),
	verificationCommands: z
		.array(verificationCommandSchema)
		.optional()
		.describe(
			"Array of verification commands with their source type for baseline filtering",
		),
});

export type CompletePreflightInput = z.infer<
	typeof completePreflightInputSchema
>;

// =============================================================================
// Tool Definition
// =============================================================================

export const completePreflightTool: ToolDefinition<CompletePreflightInput> = {
	name: "complete_preflight",
	description: `Signal preflight environment setup is complete.
Use after initializing dependencies and recording baselines.

Provide:
- summary: Brief description of what was set up
- setupCommands: List of commands that were run
- buildSuccess: Whether the project builds successfully
- baselinesRecorded: Count of baseline issues recorded`,
	inputSchema: completePreflightInputSchema,
	execute: async (input, context): Promise<ToolResult> => {
		// Validate we have a workflow context
		if (!context.workflowId) {
			return {
				success: false,
				output: "Error: complete_preflight requires a workflow context",
			};
		}

		// If build failed, we cannot proceed
		if (!input.buildSuccess) {
			return {
				success: false,
				output:
					"Error: Cannot complete preflight: build did not succeed. Fix build issues or record them as baselines if they are pre-existing.",
			};
		}

		try {
			const { pulses } = getRepositories();

			// Mark preflight as complete in the database
			// Note: Session transition to first pulse is handled by AgentRunner
			// after this turn completes (via handleTurnCompletion)
			await pulses.completePreflightSetup(
				context.workflowId,
				input.verificationCommands,
			);

			// Execute verification commands and store baseline outputs
			const verificationCommands = input.verificationCommands ?? [];
			const worktreePath = context.worktreePath;
			const failedBaselines: string[] = [];

			if (worktreePath && verificationCommands.length > 0) {
				for (const cmd of verificationCommands) {
					try {
						const proc = Bun.spawn(getShellArgs(cmd.command), {
							cwd: worktreePath,
							stdin: "ignore",
							stdout: "pipe",
							stderr: "pipe",
						});

						// Capture stdout/stderr with timeout using Promise.race pattern
						const [stdout, stderr, exitCode] = await Promise.race([
							(async () => {
								const stdoutText = await new Response(proc.stdout).text();
								const stderrText = await new Response(proc.stderr).text();
								const code = await proc.exited;
								return [stdoutText, stderrText, code] as const;
							})(),
							new Promise<never>((_, reject) => {
								const timeoutId = setTimeout(() => {
									proc.kill();
									reject(new Error("Command timed out"));
								}, 180_000);
								// Clean up if the command finishes first
								proc.exited.then(() => clearTimeout(timeoutId));
							}),
						]);

						// Store baseline output
						await pulses.recordCommandBaseline(
							context.workflowId,
							cmd.command,
							cmd.source,
							stdout,
							stderr,
							exitCode,
						);

						log.workflow.info(
							`Recorded baseline for command "${cmd.command}" (exit code: ${exitCode})`,
						);
					} catch (error) {
						// Log warning and track failure - do not fail preflight
						const errorMsg =
							error instanceof Error ? error.message : "Unknown error";
						log.workflow.warn(
							`Failed to record baseline for command "${cmd.command}": ${errorMsg}`,
						);
						failedBaselines.push(cmd.command);
					}
				}
			}

			log.workflow.info(
				`Preflight complete for workflow ${context.workflowId}: ${input.summary}`,
			);

			// Broadcast preflight completed event to UI
			broadcast(
				createPreflightCompletedEvent({
					workflowId: context.workflowId,
					summary: input.summary,
					baselinesRecorded: input.baselinesRecorded,
				}),
			);

			// Build output message with warning if baselines failed
			let outputMsg = `Preflight complete. Setup: ${input.setupCommands.length} commands run, ${input.baselinesRecorded} baselines recorded.`;
			if (failedBaselines.length > 0) {
				outputMsg += ` Warning: Failed to record baselines for: ${failedBaselines.join(", ")}. Pulse verification may fail for these commands.`;
			}
			outputMsg += " Wait for the user to respond.";

			return {
				success: true,
				output: outputMsg,
			};
		} catch (error) {
			return {
				success: false,
				output: `Error: ${error instanceof Error ? error.message : "Failed to complete preflight"}`,
			};
		}
	},
};
