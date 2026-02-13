/**
 * submit_persona_roadmap - Submit a persona's roadmap proposal
 *
 * Called by persona subagent sessions to persist their roadmap proposal.
 * Stores the roadmap data as JSON in persona_roadmaps.roadmap_data,
 * checks if all sibling personas are done, and kicks off the synthesis
 * agent when all 4 have completed.
 */

import { z } from "zod";
import { getProjectDb } from "@/backend/db/project";
import { log } from "@/backend/logger";
import {
	completePersonaAndCheckDone,
	getPersonaRoadmap,
	startSynthesisSession,
} from "@/backend/services/personaRoadmaps";
import { broadcast } from "@/backend/ws";
import { createPersonaRoadmapSubmittedEvent } from "@/shared/schemas/events";
import { InitiativeSizeSchema } from "@/shared/schemas/roadmap";
import {
	REASON_DESCRIPTION,
	registerTool,
	type ToolDefinition,
	type ToolResult,
} from "../types";

// =============================================================================
// Schema
// =============================================================================

export const submitPersonaRoadmapInputSchema = z.object({
	reason: z.string().describe(REASON_DESCRIPTION),
	vision: z.string().describe("The product vision summary for this roadmap"),
	milestones: z
		.array(
			z.object({
				title: z.string().describe("Milestone title"),
				description: z.string().optional().describe("Milestone description"),
				initiatives: z
					.array(
						z.object({
							title: z.string().describe("Initiative title"),
							description: z
								.string()
								.optional()
								.describe("Initiative description"),
							priority: z
								.enum(["low", "medium", "high", "critical"])
								.optional()
								.describe("Priority level of the initiative"),
							size: InitiativeSizeSchema.optional().describe(
								"Effort size using Fibonacci-like scale: 1, 2, 3, 5, 8, 13, or 21. Represents relative effort, not time.",
							),
						}),
					)
					.describe("Initiatives within this milestone"),
			}),
		)
		.describe("Milestones with their nested initiatives"),
});

export type SubmitPersonaRoadmapInput = z.infer<
	typeof submitPersonaRoadmapInputSchema
>;

// =============================================================================
// Tool Definition
// =============================================================================

export const submitPersonaRoadmapTool: ToolDefinition<SubmitPersonaRoadmapInput> =
	{
		name: "submit_persona_roadmap",
		description: `Submit your persona's roadmap proposal.
Call this tool once you have completed your roadmap planning.
Persists your vision, milestones, and initiatives as a persona roadmap proposal.
This is a terminal tool — your session ends after submission.`,
		inputSchema: submitPersonaRoadmapInputSchema,
		execute: async (input, context): Promise<ToolResult> => {
			if (!context.sessionId) {
				return {
					success: false,
					output:
						"Error: No session context — submit_persona_roadmap requires an active session",
				};
			}

			try {
				const db = await getProjectDb(context.projectRoot);

				// personaRoadmapId is set by AgentRunner.createToolContext for persona sessions
				const personaRoadmapId = context.personaRoadmapId;

				if (!personaRoadmapId) {
					return {
						success: false,
						output:
							"Error: No persona roadmap context — submit_persona_roadmap requires a persona session",
					};
				}

				// Build the roadmap data payload to persist as JSON
				const roadmapData = {
					vision: input.vision,
					milestones: input.milestones,
				};

				// Atomically complete persona and check if all siblings are done.
				// The transaction ensures that when two personas complete near-simultaneously,
				// only one caller gets allTerminal === true, which gates synthesis launch.
				const { allCompleted, allTerminal, roadmapId } =
					await completePersonaAndCheckDone(db, personaRoadmapId, roadmapData);

				// Broadcast persona completion — non-critical, must not block synthesis
				try {
					const personaRecord = await getPersonaRoadmap(db, personaRoadmapId);
					const persona = personaRecord?.persona ?? "unknown";

					broadcast(
						createPersonaRoadmapSubmittedEvent({
							sessionId: context.sessionId,
							roadmapId,
							persona,
							personaRoadmapId,
							roadmapData,
						}),
					);

					log.tools.info(
						`Persona roadmap submitted: ${persona} for roadmap ${roadmapId} (allCompleted=${allCompleted})`,
					);
				} catch (broadcastError) {
					log.tools.warn(
						`Failed to broadcast persona completion for ${personaRoadmapId}: ${broadcastError instanceof Error ? broadcastError.message : "unknown error"}`,
					);
				}

				if (allTerminal) {
					log.tools.info(
						`All personas terminal for roadmap ${roadmapId} (allCompleted=${allCompleted}) — launching synthesis session`,
					);
					startSynthesisSession(context.projectRoot, roadmapId, db);
				}

				return {
					success: true,
					output: "Persona roadmap submitted successfully.",
				};
			} catch (error) {
				return {
					success: false,
					output: `Error: Failed to submit persona roadmap: ${error instanceof Error ? error.message : "unknown error"}`,
				};
			}
		},
	};

// =============================================================================
// Tool Registration
// =============================================================================

export const PERSONA_ROADMAP_TOOLS = [registerTool(submitPersonaRoadmapTool)];
