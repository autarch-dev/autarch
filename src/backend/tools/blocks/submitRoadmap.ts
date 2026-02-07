/**
 * submit_roadmap - Submit a finalized roadmap plan
 *
 * Persists the complete roadmap structure (vision, milestones, initiatives,
 * dependencies) to the database in a single transaction and activates the roadmap.
 */

import { z } from "zod";
import { getProjectDb } from "@/backend/db/project";
import { ids } from "@/backend/utils";
import { broadcast } from "@/backend/ws";
import { createRoadmapUpdatedEvent } from "@/shared/schemas/events";
import type { ToolDefinition, ToolResult } from "../types";

// =============================================================================
// Schema
// =============================================================================

export const submitRoadmapInputSchema = z.object({
	vision: z.object({
		content: z
			.string()
			.describe("The product vision document content in markdown"),
	}),
	milestones: z
		.array(
			z.object({
				title: z.string().describe("Milestone title"),
				description: z.string().optional().describe("Milestone description"),
				sortOrder: z.number().describe("Display order of this milestone"),
				initiatives: z
					.array(
						z.object({
							title: z.string().describe("Initiative title"),
							description: z
								.string()
								.optional()
								.describe("Initiative description"),
							status: z
								.enum(["not_started", "in_progress", "completed", "blocked"])
								.optional()
								.describe("Current status of the initiative"),
							priority: z
								.enum(["low", "medium", "high", "critical"])
								.optional()
								.describe("Priority level of the initiative"),
							size: z
								.number()
								.optional()
								.describe(
									"Effort size using Fibonacci-like scale: 1, 2, 3, 5, 8, 13, or 21. Represents relative effort, not time.",
								),
							sortOrder: z
								.number()
								.describe("Display order within the milestone"),
						}),
					)
					.describe("Initiatives within this milestone"),
			}),
		)
		.describe("Milestones with their nested initiatives"),
	dependencies: z
		.array(
			z.object({
				sourceType: z
					.enum(["milestone", "initiative"])
					.describe("Type of the source node"),
				sourcePath: z
					.string()
					.describe(
						"Source node path, e.g. 'milestone:0' or 'milestone:1/initiative:2' using title+index",
					),
				targetType: z
					.enum(["milestone", "initiative"])
					.describe("Type of the target node"),
				targetPath: z
					.string()
					.describe(
						"Target node path, e.g. 'milestone:0' or 'milestone:0/initiative:1' using title+index",
					),
			}),
		)
		.describe("Dependencies between milestones and/or initiatives"),
});

export type SubmitRoadmapInput = z.infer<typeof submitRoadmapInputSchema>;

// =============================================================================
// Helpers
// =============================================================================

/**
 * Resolve a dependency path like 'milestone:0' or 'milestone:1/initiative:2'
 * to an actual entity ID using the created milestone and initiative ID maps.
 */
function resolvePath(
	path: string,
	milestoneIds: string[],
	initiativeIds: Map<string, string[]>,
): string | null {
	const parts = path.split("/");

	// Parse the milestone index
	const milestoneMatch = parts[0]?.match(/^milestone:(\d+)$/);
	if (!milestoneMatch?.[1]) return null;
	const milestoneIndex = Number.parseInt(milestoneMatch[1], 10);

	if (milestoneIndex < 0 || milestoneIndex >= milestoneIds.length) return null;
	const milestoneId = milestoneIds[milestoneIndex];
	if (!milestoneId) return null;

	// If only a milestone reference, return its ID
	if (parts.length === 1) return milestoneId;

	// Parse the initiative index
	const initiativeMatch = parts[1]?.match(/^initiative:(\d+)$/);
	if (!initiativeMatch?.[1]) return null;
	const initiativeIndex = Number.parseInt(initiativeMatch[1], 10);

	const milestoneInitiatives = initiativeIds.get(milestoneId);
	if (!milestoneInitiatives) return null;
	if (initiativeIndex < 0 || initiativeIndex >= milestoneInitiatives.length)
		return null;

	return milestoneInitiatives[initiativeIndex] ?? null;
}

// =============================================================================
// Tool Definition
// =============================================================================

export const submitRoadmapTool: ToolDefinition<SubmitRoadmapInput> = {
	name: "submit_roadmap",
	description: `Submit a finalized roadmap plan with vision, milestones, initiatives, and dependencies.
Use when the roadmap planning conversation is complete and the user has confirmed the plan.
This will persist the entire roadmap structure and activate it.`,
	inputSchema: submitRoadmapInputSchema,
	execute: async (input, context): Promise<ToolResult> => {
		// Roadmap ID is required for storing roadmap entities
		if (!context.roadmapId) {
			return {
				success: false,
				output:
					"Error: No roadmap context - submit_roadmap can only be used in roadmap sessions",
			};
		}

		const roadmapId = context.roadmapId;

		try {
			const db = await getProjectDb(context.projectRoot);

			// Track created entity IDs for dependency resolution
			const milestoneIds: string[] = [];
			// Map from milestone ID to array of initiative IDs (in order)
			const initiativeIds = new Map<string, string[]>();

			await db.transaction().execute(async (trx) => {
				const now = Date.now();

				// 0. Clear existing roadmap entities to support idempotent re-submission
				// Delete dependencies referencing this roadmap's milestones/initiatives
				const existingMilestones = await trx
					.selectFrom("milestones")
					.select("id")
					.where("roadmap_id", "=", roadmapId)
					.execute();
				const existingInitiatives = await trx
					.selectFrom("initiatives")
					.select("id")
					.where("roadmap_id", "=", roadmapId)
					.execute();
				const existingNodeIds = [
					...existingMilestones.map((m) => m.id),
					...existingInitiatives.map((i) => i.id),
				];
				if (existingNodeIds.length > 0) {
					await trx
						.deleteFrom("dependencies")
						.where((eb) =>
							eb.or([
								eb("source_id", "in", existingNodeIds),
								eb("target_id", "in", existingNodeIds),
							]),
						)
						.execute();
				}
				// Delete existing initiatives and milestones
				await trx
					.deleteFrom("initiatives")
					.where("roadmap_id", "=", roadmapId)
					.execute();
				await trx
					.deleteFrom("milestones")
					.where("roadmap_id", "=", roadmapId)
					.execute();

				// 1. Upsert vision document
				const existingVision = await trx
					.selectFrom("vision_documents")
					.selectAll()
					.where("roadmap_id", "=", roadmapId)
					.executeTakeFirst();

				if (existingVision) {
					await trx
						.updateTable("vision_documents")
						.set({
							content: input.vision.content,
							updated_at: now,
						})
						.where("roadmap_id", "=", roadmapId)
						.execute();
				} else {
					await trx
						.insertInto("vision_documents")
						.values({
							id: ids.vision(),
							roadmap_id: roadmapId,
							content: input.vision.content,
							created_at: now,
							updated_at: now,
						})
						.execute();
				}

				// 2. Create milestones and their initiatives
				for (const milestone of input.milestones) {
					const milestoneId = ids.milestone();

					await trx
						.insertInto("milestones")
						.values({
							id: milestoneId,
							roadmap_id: roadmapId,
							title: milestone.title,
							description: milestone.description ?? null,
							sort_order: milestone.sortOrder,
							created_at: now,
							updated_at: now,
						})
						.execute();

					milestoneIds.push(milestoneId);
					const milestoneInitiativeIds: string[] = [];

					for (const initiative of milestone.initiatives) {
						const initiativeId = ids.initiative();

						await trx
							.insertInto("initiatives")
							.values({
								id: initiativeId,
								milestone_id: milestoneId,
								roadmap_id: roadmapId,
								title: initiative.title,
								description: initiative.description ?? null,
								status: initiative.status ?? "not_started",
								priority: initiative.priority ?? "medium",
								progress: 0,
								progress_mode: "auto",
								workflow_id: null,
								size: initiative.size ?? null,
								sort_order: initiative.sortOrder,
								created_at: now,
								updated_at: now,
							})
							.execute();

						milestoneInitiativeIds.push(initiativeId);
					}

					initiativeIds.set(milestoneId, milestoneInitiativeIds);
				}

				// 3. Create dependencies
				for (const dep of input.dependencies) {
					const sourceId = resolvePath(
						dep.sourcePath,
						milestoneIds,
						initiativeIds,
					);
					const targetId = resolvePath(
						dep.targetPath,
						milestoneIds,
						initiativeIds,
					);

					if (!sourceId || !targetId) {
						throw new Error(
							`Failed to resolve dependency path: source="${dep.sourcePath}", target="${dep.targetPath}"`,
						);
					}

					await trx
						.insertInto("dependencies")
						.values({
							id: ids.dep(),
							source_type: dep.sourceType,
							source_id: sourceId,
							target_type: dep.targetType,
							target_id: targetId,
							created_at: now,
						})
						.execute();
				}

				// 4. Update roadmap status from 'draft' to 'active'
				await trx
					.updateTable("roadmaps")
					.set({
						status: "active",
						updated_at: now,
					})
					.where("id", "=", roadmapId)
					.execute();
			});

			// 5. Broadcast roadmap updated event
			broadcast(createRoadmapUpdatedEvent({ roadmapId }));

			return {
				success: true,
				output: "Roadmap plan submitted successfully.",
			};
		} catch (err) {
			return {
				success: false,
				output: `Error: Failed to submit roadmap: ${err instanceof Error ? err.message : "unknown error"}`,
			};
		}
	},
};
