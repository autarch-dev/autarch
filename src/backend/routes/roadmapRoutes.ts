/**
 * Roadmap API Routes
 *
 * Routes for managing roadmaps, milestones, initiatives, vision documents,
 * dependencies, and AI planning sessions.
 * Uses repositories for data access.
 */

import { z } from "zod";
import {
	createRoadmapCreatedEvent,
	createRoadmapDeletedEvent,
	createRoadmapUpdatedEvent,
} from "@/shared/schemas/events";
import {
	InitiativePrioritySchema,
	InitiativeSizeSchema,
	InitiativeStatusSchema,
	type RoadmapDependency,
	RoadmapDependencyNodeTypeSchema,
	RoadmapPerspectiveSchema,
	RoadmapStatusSchema,
} from "@/shared/schemas/roadmap";
import { ROADMAP_PLANNING_TOOLS } from "../agents/registry";
import { AgentRunner, getSessionManager } from "../agents/runner";
import { AgentRoleSchema } from "../agents/types";

import { getProjectDb } from "../db/project";
import { log } from "../logger";
import { getProjectRoot } from "../projectRoot";
import { getRepositories } from "../repositories";
import {
	createPersonaRoadmaps,
	failPersonaAndCheckDone,
	getPersonaRoadmaps,
	startSynthesisSession,
	updatePersonaSession,
} from "../services/personaRoadmaps";
import { broadcast } from "../ws";

// =============================================================================
// Request Schemas
// =============================================================================

const CreateRoadmapRequestSchema = z.object({
	title: z.string().min(1),
	perspective: RoadmapPerspectiveSchema,
	prompt: z.string().optional(),
});

const UpdateRoadmapRequestSchema = z.object({
	title: z.string().min(1).optional(),
	description: z.string().optional(),
	status: RoadmapStatusSchema.optional(),
});

const CreateMilestoneRequestSchema = z.object({
	title: z.string().min(1),
	description: z.string().optional(),
	sortOrder: z.number(),
});

const UpdateMilestoneRequestSchema = z.object({
	title: z.string().min(1).optional(),
	description: z.string().optional(),
	sortOrder: z.number().optional(),
});

const CreateInitiativeRequestSchema = z.object({
	milestoneId: z.string().min(1),
	title: z.string().min(1),
	description: z.string().optional(),
	status: InitiativeStatusSchema.optional(),
	priority: InitiativePrioritySchema.optional(),
	progress: z.number().min(0).max(100).optional(),
	workflowId: z.string().optional(),
	size: InitiativeSizeSchema.nullable().optional(),
	sortOrder: z.number(),
});

const UpdateInitiativeRequestSchema = z.object({
	title: z.string().min(1).optional(),
	description: z.string().optional(),
	status: InitiativeStatusSchema.optional(),
	priority: InitiativePrioritySchema.optional(),
	progress: z.number().min(0).max(100).optional(),
	workflowId: z.string().nullable().optional(),
	size: InitiativeSizeSchema.nullable().optional(),
	milestoneId: z.string().optional(),
	sortOrder: z.number().optional(),
});

const UpsertVisionRequestSchema = z.object({
	content: z.string(),
});

const CreateDependencyRequestSchema = z.object({
	sourceType: RoadmapDependencyNodeTypeSchema,
	sourceId: z.string().min(1),
	targetType: RoadmapDependencyNodeTypeSchema,
	targetId: z.string().min(1),
});

const IdParamSchema = z.object({
	id: z.string().min(1),
});

const IdWithMilestoneParamSchema = z.object({
	id: z.string().min(1),
	milestoneId: z.string().min(1),
});

const IdWithInitiativeParamSchema = z.object({
	id: z.string().min(1),
	initiativeId: z.string().min(1),
});

const IdWithDepParamSchema = z.object({
	id: z.string().min(1),
	depId: z.string().min(1),
});

// =============================================================================
// Helpers
// =============================================================================

/**
 * Parse and validate route params with Zod.
 * Returns null and sends error response if validation fails.
 */
function parseParams<T extends z.ZodTypeAny>(
	// biome-ignore lint/suspicious/noExplicitAny: Bun adds params to Request
	req: Request & { params?: any },
	schema: T,
): z.infer<T> | null {
	const result = schema.safeParse(req.params);
	if (!result.success) {
		return null;
	}
	return result.data;
}

/**
 * Verify a milestone belongs to the specified roadmap.
 * Returns the milestone if valid, or null if not found / doesn't belong.
 */
async function verifyMilestoneOwnership(
	roadmapId: string,
	milestoneId: string,
): Promise<boolean> {
	const repos = getRepositories();
	const milestone = await repos.roadmaps.getMilestone(milestoneId);
	return milestone !== null && milestone.roadmapId === roadmapId;
}

/**
 * Verify an initiative belongs to the specified roadmap.
 */
async function verifyInitiativeOwnership(
	roadmapId: string,
	initiativeId: string,
): Promise<boolean> {
	const repos = getRepositories();
	const initiative = await repos.roadmaps.getInitiative(initiativeId);
	return initiative !== null && initiative.roadmapId === roadmapId;
}

/**
 * Verify a dependency node (milestone or initiative) belongs to the specified roadmap.
 */
async function verifyNodeOwnership(
	roadmapId: string,
	nodeType: string,
	nodeId: string,
): Promise<boolean> {
	if (nodeType === "milestone") {
		return verifyMilestoneOwnership(roadmapId, nodeId);
	}
	return verifyInitiativeOwnership(roadmapId, nodeId);
}

/**
 * Check if adding a dependency from source to target would create a cycle.
 * Uses DFS from the target node to see if the source node is reachable
 * through existing dependencies.
 */
function wouldCreateCycle(
	sourceType: string,
	sourceId: string,
	targetType: string,
	targetId: string,
	existingDeps: RoadmapDependency[],
): boolean {
	const sourceKey = `${sourceType}:${sourceId}`;
	const targetKey = `${targetType}:${targetId}`;

	// Build adjacency list: source depends on target means edge source -> target
	const graph = new Map<string, string[]>();
	for (const dep of existingDeps) {
		const from = `${dep.sourceType}:${dep.sourceId}`;
		const to = `${dep.targetType}:${dep.targetId}`;
		const neighbors = graph.get(from) || [];
		neighbors.push(to);
		graph.set(from, neighbors);
	}

	// Add the proposed edge
	const neighbors = graph.get(sourceKey) || [];
	neighbors.push(targetKey);
	graph.set(sourceKey, neighbors);

	// DFS from sourceKey to see if we can reach sourceKey again (cycle)
	const visited = new Set<string>();
	const stack = [targetKey];
	while (stack.length > 0) {
		// biome-ignore lint/style/noNonNullAssertion: length check guarantees element exists
		const current = stack.pop()!;
		if (current === sourceKey) {
			return true;
		}
		if (visited.has(current)) {
			continue;
		}
		visited.add(current);
		for (const neighbor of graph.get(current) || []) {
			stack.push(neighbor);
		}
	}

	return false;
}

/**
 * Start parallel persona planning sessions for a roadmap.
 * Creates 4 persona records and launches an agent session for each.
 * Follows the spawnReviewTasks fire-and-forget pattern.
 */
async function startPersonaSessions(
	roadmapId: string,
	title: string,
	perspective: string,
	initialPrompt?: string,
): Promise<void> {
	const projectRoot = getProjectRoot();
	const db = await getProjectDb(projectRoot);
	const sessionManager = getSessionManager();
	const repos = getRepositories();

	const context = initialPrompt
		? `\n\nAdditional context from the user:\n${initialPrompt}`
		: "";

	// Single-persona mode: skip persona_roadmaps entirely, write directly to roadmap tables
	if (perspective !== "balanced") {
		try {
			const session = await sessionManager.startSession({
				contextType: "roadmap",
				contextId: roadmapId,
				agentRole: AgentRoleSchema.parse(perspective),
				roadmapId,
			});

			const initialMessage =
				`You are working on a roadmap titled "${title}".${context}\n\n` +
				"Please analyze this and create a comprehensive roadmap. Use the submit_roadmap tool to submit your final roadmap. Provide sortOrder as sequential numbers starting from 0 for milestones and initiatives.";

			const runner = new AgentRunner(session, {
				projectRoot,
				conversationRepo: repos.conversations,
				toolsOverride: ROADMAP_PLANNING_TOOLS,
			});

			runner.run(initialMessage).catch(async (err) => {
				const errorMsg = err instanceof Error ? err.message : "Unknown error";
				log.agent.error(
					`Single-persona ${perspective} session ${session.id} failed: ${errorMsg}`,
				);
				sessionManager.errorSession(session.id, errorMsg);

				try {
					await repos.roadmaps.updateRoadmap(roadmapId, { status: "error" });
				} catch (failErr) {
					log.agent.error(
						`Failed to set roadmap ${roadmapId} to error status:`,
						failErr,
					);
				}
			});
		} catch (err) {
			const errorMsg = err instanceof Error ? err.message : "Unknown error";
			log.agent.error(
				`Failed to spawn single-persona ${perspective} for roadmap ${roadmapId}: ${errorMsg}`,
			);

			try {
				await repos.roadmaps.updateRoadmap(roadmapId, { status: "error" });
			} catch (failErr) {
				log.agent.error(
					`Failed to set roadmap ${roadmapId} to error status:`,
					failErr,
				);
			}
		}
		return;
	}

	// Balanced mode: create 4 persona roadmaps and run all persona sessions
	const personaRecords = await createPersonaRoadmaps(db, roadmapId);

	for (const persona of personaRecords) {
		try {
			const session = await sessionManager.startSession({
				contextType: "persona",
				contextId: persona.id,
				agentRole: AgentRoleSchema.parse(persona.persona),
				roadmapId,
			});

			await updatePersonaSession(db, persona.id, session.id);

			const initialMessage =
				`You are working on a roadmap titled "${title}".${context}\n\n` +
				"Please analyze this from your unique perspective and produce a complete roadmap proposal.";

			const runner = new AgentRunner(session, {
				projectRoot,
				conversationRepo: repos.conversations,
			});

			runner.run(initialMessage).catch(async (err) => {
				const errorMsg = err instanceof Error ? err.message : "Unknown error";
				log.agent.error(
					`Persona ${persona.persona} session ${session.id} failed: ${errorMsg}`,
				);
				sessionManager.errorSession(session.id, errorMsg);

				// Mark the persona_roadmaps record as failed and check if all siblings are terminal
				try {
					const { allTerminal } = await failPersonaAndCheckDone(db, persona.id);

					if (allTerminal) {
						log.agent.info(
							`All personas terminal for roadmap ${roadmapId} (some failed) — launching synthesis with partial results`,
						);
						startSynthesisSession(projectRoot, roadmapId, db);
					}
				} catch (failErr) {
					log.agent.error(
						`Failed to handle persona failure for ${persona.persona} (roadmap ${roadmapId}):`,
						failErr,
					);
				}
			});
		} catch (err) {
			const errorMsg = err instanceof Error ? err.message : "Unknown error";
			log.agent.error(
				`Failed to spawn persona ${persona.persona} for roadmap ${roadmapId}: ${errorMsg}`,
			);

			try {
				const { allTerminal } = await failPersonaAndCheckDone(db, persona.id);

				if (allTerminal) {
					log.agent.info(
						`All personas terminal for roadmap ${roadmapId} (some failed) — launching synthesis with partial results`,
					);
					startSynthesisSession(projectRoot, roadmapId, db);
				}
			} catch (failErr) {
				log.agent.error(
					`Failed to handle persona failure for ${persona.persona} (roadmap ${roadmapId}):`,
					failErr,
				);
			}
		}
	}
}

// =============================================================================
// Routes
// =============================================================================

export const roadmapRoutes = {
	"/api/roadmaps": {
		async GET() {
			try {
				const repos = getRepositories();
				const roadmaps = await repos.roadmaps.listRoadmaps();
				return Response.json(roadmaps);
			} catch (error) {
				log.api.error("Failed to list roadmaps:", error);
				return Response.json(
					{ error: error instanceof Error ? error.message : "Unknown error" },
					{ status: 500 },
				);
			}
		},

		async POST(req: Request) {
			try {
				const body = await req.json();
				const parsed = CreateRoadmapRequestSchema.safeParse(body);
				if (!parsed.success) {
					return Response.json(
						{
							error: "Invalid request body",
							details: z.prettifyError(parsed.error),
						},
						{ status: 400 },
					);
				}

				const repos = getRepositories();
				const roadmap = await repos.roadmaps.createRoadmap({
					title: parsed.data.title,
					status: "draft",
					perspective: parsed.data.perspective,
				});

				await startPersonaSessions(
					roadmap.id,
					parsed.data.title,
					parsed.data.perspective,
					parsed.data.prompt,
				);

				broadcast(
					createRoadmapCreatedEvent({
						roadmapId: roadmap.id,
						title: roadmap.title,
						status: roadmap.status,
						perspective: roadmap.perspective,
					}),
				);

				log.api.success(`Created roadmap: ${roadmap.id}`);
				return Response.json(roadmap, { status: 201 });
			} catch (error) {
				log.api.error("Failed to create roadmap:", error);
				return Response.json(
					{ error: error instanceof Error ? error.message : "Unknown error" },
					{ status: 500 },
				);
			}
		},
	},

	"/api/roadmaps/:id": {
		async GET(req: Request) {
			const params = parseParams(req, IdParamSchema);
			if (!params) {
				return Response.json({ error: "Invalid roadmap ID" }, { status: 400 });
			}
			try {
				const repos = getRepositories();
				const details = await repos.roadmaps.getRoadmapWithDetails(params.id);
				if (!details) {
					return Response.json({ error: "Roadmap not found" }, { status: 404 });
				}
				return Response.json(details);
			} catch (error) {
				log.api.error("Failed to get roadmap:", error);
				return Response.json(
					{ error: error instanceof Error ? error.message : "Unknown error" },
					{ status: 500 },
				);
			}
		},

		async PUT(req: Request) {
			const params = parseParams(req, IdParamSchema);
			if (!params) {
				return Response.json({ error: "Invalid roadmap ID" }, { status: 400 });
			}
			try {
				const body = await req.json();
				const parsed = UpdateRoadmapRequestSchema.safeParse(body);
				if (!parsed.success) {
					return Response.json(
						{
							error: "Invalid request body",
							details: z.prettifyError(parsed.error),
						},
						{ status: 400 },
					);
				}

				const repos = getRepositories();
				const roadmap = await repos.roadmaps.updateRoadmap(
					params.id,
					parsed.data,
				);

				broadcast(createRoadmapUpdatedEvent({ roadmapId: roadmap.id }));

				return Response.json(roadmap);
			} catch (error) {
				log.api.error("Failed to update roadmap:", error);
				return Response.json(
					{ error: error instanceof Error ? error.message : "Unknown error" },
					{ status: 500 },
				);
			}
		},

		async DELETE(req: Request) {
			const params = parseParams(req, IdParamSchema);
			if (!params) {
				return Response.json({ error: "Invalid roadmap ID" }, { status: 400 });
			}
			try {
				const repos = getRepositories();
				await repos.roadmaps.deleteRoadmap(params.id);

				broadcast(createRoadmapDeletedEvent({ roadmapId: params.id }));

				return new Response(null, { status: 204 });
			} catch (error) {
				log.api.error("Failed to delete roadmap:", error);
				return Response.json(
					{ error: error instanceof Error ? error.message : "Unknown error" },
					{ status: 500 },
				);
			}
		},
	},

	"/api/roadmaps/:id/milestones": {
		async POST(req: Request) {
			const params = parseParams(req, IdParamSchema);
			if (!params) {
				return Response.json({ error: "Invalid roadmap ID" }, { status: 400 });
			}
			try {
				const body = await req.json();
				const parsed = CreateMilestoneRequestSchema.safeParse(body);
				if (!parsed.success) {
					return Response.json(
						{
							error: "Invalid request body",
							details: z.prettifyError(parsed.error),
						},
						{ status: 400 },
					);
				}

				const repos = getRepositories();
				const roadmap = await repos.roadmaps.getRoadmap(params.id);
				if (!roadmap) {
					return Response.json({ error: "Roadmap not found" }, { status: 404 });
				}

				const milestone = await repos.roadmaps.createMilestone({
					roadmapId: params.id,
					...parsed.data,
				});

				broadcast(createRoadmapUpdatedEvent({ roadmapId: params.id }));

				log.api.success(`Created milestone: ${milestone.id}`);
				return Response.json(milestone, { status: 201 });
			} catch (error) {
				log.api.error("Failed to create milestone:", error);
				return Response.json(
					{ error: error instanceof Error ? error.message : "Unknown error" },
					{ status: 500 },
				);
			}
		},
	},

	"/api/roadmaps/:id/milestones/:milestoneId": {
		async PUT(req: Request) {
			const params = parseParams(req, IdWithMilestoneParamSchema);
			if (!params) {
				return Response.json(
					{ error: "Invalid roadmap or milestone ID" },
					{ status: 400 },
				);
			}
			try {
				if (!(await verifyMilestoneOwnership(params.id, params.milestoneId))) {
					return Response.json(
						{ error: "Milestone not found in this roadmap" },
						{ status: 404 },
					);
				}

				const body = await req.json();
				const parsed = UpdateMilestoneRequestSchema.safeParse(body);
				if (!parsed.success) {
					return Response.json(
						{
							error: "Invalid request body",
							details: z.prettifyError(parsed.error),
						},
						{ status: 400 },
					);
				}

				const repos = getRepositories();
				const milestone = await repos.roadmaps.updateMilestone(
					params.milestoneId,
					parsed.data,
				);

				broadcast(createRoadmapUpdatedEvent({ roadmapId: params.id }));

				return Response.json(milestone);
			} catch (error) {
				log.api.error("Failed to update milestone:", error);
				return Response.json(
					{ error: error instanceof Error ? error.message : "Unknown error" },
					{ status: 500 },
				);
			}
		},

		async DELETE(req: Request) {
			const params = parseParams(req, IdWithMilestoneParamSchema);
			if (!params) {
				return Response.json(
					{ error: "Invalid roadmap or milestone ID" },
					{ status: 400 },
				);
			}
			try {
				if (!(await verifyMilestoneOwnership(params.id, params.milestoneId))) {
					return Response.json(
						{ error: "Milestone not found in this roadmap" },
						{ status: 404 },
					);
				}

				const repos = getRepositories();
				await repos.roadmaps.deleteMilestone(params.milestoneId);

				broadcast(createRoadmapUpdatedEvent({ roadmapId: params.id }));

				return new Response(null, { status: 204 });
			} catch (error) {
				log.api.error("Failed to delete milestone:", error);
				return Response.json(
					{ error: error instanceof Error ? error.message : "Unknown error" },
					{ status: 500 },
				);
			}
		},
	},

	"/api/roadmaps/:id/initiatives": {
		async POST(req: Request) {
			const params = parseParams(req, IdParamSchema);
			if (!params) {
				return Response.json({ error: "Invalid roadmap ID" }, { status: 400 });
			}
			try {
				const body = await req.json();
				const parsed = CreateInitiativeRequestSchema.safeParse(body);
				if (!parsed.success) {
					return Response.json(
						{
							error: "Invalid request body",
							details: z.prettifyError(parsed.error),
						},
						{ status: 400 },
					);
				}

				const repos = getRepositories();
				const roadmap = await repos.roadmaps.getRoadmap(params.id);
				if (!roadmap) {
					return Response.json({ error: "Roadmap not found" }, { status: 404 });
				}

				if (
					!(await verifyMilestoneOwnership(params.id, parsed.data.milestoneId))
				) {
					return Response.json(
						{ error: "Milestone not found in this roadmap" },
						{ status: 400 },
					);
				}

				const initiative = await repos.roadmaps.createInitiative({
					roadmapId: params.id,
					...parsed.data,
				});

				broadcast(createRoadmapUpdatedEvent({ roadmapId: params.id }));

				log.api.success(`Created initiative: ${initiative.id}`);
				return Response.json(initiative, { status: 201 });
			} catch (error) {
				log.api.error("Failed to create initiative:", error);
				return Response.json(
					{ error: error instanceof Error ? error.message : "Unknown error" },
					{ status: 500 },
				);
			}
		},
	},

	"/api/roadmaps/:id/initiatives/:initiativeId": {
		async PUT(req: Request) {
			const params = parseParams(req, IdWithInitiativeParamSchema);
			if (!params) {
				return Response.json(
					{ error: "Invalid roadmap or initiative ID" },
					{ status: 400 },
				);
			}
			try {
				if (
					!(await verifyInitiativeOwnership(params.id, params.initiativeId))
				) {
					return Response.json(
						{ error: "Initiative not found in this roadmap" },
						{ status: 404 },
					);
				}

				const body = await req.json();
				const parsed = UpdateInitiativeRequestSchema.safeParse(body);
				if (!parsed.success) {
					return Response.json(
						{
							error: "Invalid request body",
							details: z.prettifyError(parsed.error),
						},
						{ status: 400 },
					);
				}

				const repos = getRepositories();
				const initiative = await repos.roadmaps.updateInitiative(
					params.initiativeId,
					parsed.data,
				);

				broadcast(createRoadmapUpdatedEvent({ roadmapId: params.id }));

				return Response.json(initiative);
			} catch (error) {
				log.api.error("Failed to update initiative:", error);
				return Response.json(
					{ error: error instanceof Error ? error.message : "Unknown error" },
					{ status: 500 },
				);
			}
		},

		async DELETE(req: Request) {
			const params = parseParams(req, IdWithInitiativeParamSchema);
			if (!params) {
				return Response.json(
					{ error: "Invalid roadmap or initiative ID" },
					{ status: 400 },
				);
			}
			try {
				if (
					!(await verifyInitiativeOwnership(params.id, params.initiativeId))
				) {
					return Response.json(
						{ error: "Initiative not found in this roadmap" },
						{ status: 404 },
					);
				}

				const repos = getRepositories();
				await repos.roadmaps.deleteInitiative(params.initiativeId);

				broadcast(createRoadmapUpdatedEvent({ roadmapId: params.id }));

				return new Response(null, { status: 204 });
			} catch (error) {
				log.api.error("Failed to delete initiative:", error);
				return Response.json(
					{ error: error instanceof Error ? error.message : "Unknown error" },
					{ status: 500 },
				);
			}
		},
	},

	"/api/roadmaps/:id/vision": {
		async GET(req: Request) {
			const params = parseParams(req, IdParamSchema);
			if (!params) {
				return Response.json({ error: "Invalid roadmap ID" }, { status: 400 });
			}
			try {
				const repos = getRepositories();
				const vision = await repos.roadmaps.getVisionDocument(params.id);
				if (!vision) {
					return Response.json(
						{ error: "Vision document not found" },
						{ status: 404 },
					);
				}
				return Response.json(vision);
			} catch (error) {
				log.api.error("Failed to get vision document:", error);
				return Response.json(
					{ error: error instanceof Error ? error.message : "Unknown error" },
					{ status: 500 },
				);
			}
		},

		async PUT(req: Request) {
			const params = parseParams(req, IdParamSchema);
			if (!params) {
				return Response.json({ error: "Invalid roadmap ID" }, { status: 400 });
			}
			try {
				const body = await req.json();
				const parsed = UpsertVisionRequestSchema.safeParse(body);
				if (!parsed.success) {
					return Response.json(
						{
							error: "Invalid request body",
							details: z.prettifyError(parsed.error),
						},
						{ status: 400 },
					);
				}

				const repos = getRepositories();
				const vision = await repos.roadmaps.upsertVisionDocument(
					params.id,
					parsed.data.content,
				);

				broadcast(createRoadmapUpdatedEvent({ roadmapId: params.id }));

				return Response.json(vision);
			} catch (error) {
				log.api.error("Failed to upsert vision document:", error);
				return Response.json(
					{ error: error instanceof Error ? error.message : "Unknown error" },
					{ status: 500 },
				);
			}
		},
	},

	"/api/roadmaps/:id/dependencies": {
		async POST(req: Request) {
			const params = parseParams(req, IdParamSchema);
			if (!params) {
				return Response.json({ error: "Invalid roadmap ID" }, { status: 400 });
			}
			try {
				const body = await req.json();
				const parsed = CreateDependencyRequestSchema.safeParse(body);
				if (!parsed.success) {
					return Response.json(
						{
							error: "Invalid request body",
							details: z.prettifyError(parsed.error),
						},
						{ status: 400 },
					);
				}

				// Reject self-referencing dependencies
				if (
					parsed.data.sourceType === parsed.data.targetType &&
					parsed.data.sourceId === parsed.data.targetId
				) {
					return Response.json(
						{ error: "An entity cannot depend on itself" },
						{ status: 400 },
					);
				}

				// Verify both source and target belong to this roadmap
				const [sourceOwned, targetOwned] = await Promise.all([
					verifyNodeOwnership(
						params.id,
						parsed.data.sourceType,
						parsed.data.sourceId,
					),
					verifyNodeOwnership(
						params.id,
						parsed.data.targetType,
						parsed.data.targetId,
					),
				]);
				if (!sourceOwned || !targetOwned) {
					return Response.json(
						{
							error: "Source or target entity not found in this roadmap",
						},
						{ status: 400 },
					);
				}

				// Check for circular dependencies via DFS from target to see if source is reachable
				const repos = getRepositories();
				const existingDeps = await repos.roadmaps.listDependencies(params.id);
				if (
					wouldCreateCycle(
						parsed.data.sourceType,
						parsed.data.sourceId,
						parsed.data.targetType,
						parsed.data.targetId,
						existingDeps,
					)
				) {
					return Response.json(
						{
							error: "Adding this dependency would create a circular reference",
						},
						{ status: 400 },
					);
				}

				const dependency = await repos.roadmaps.createDependency(parsed.data);

				broadcast(createRoadmapUpdatedEvent({ roadmapId: params.id }));

				log.api.success(`Created dependency: ${dependency.id}`);
				return Response.json(dependency, { status: 201 });
			} catch (error) {
				log.api.error("Failed to create dependency:", error);
				return Response.json(
					{ error: error instanceof Error ? error.message : "Unknown error" },
					{ status: 500 },
				);
			}
		},
	},

	"/api/roadmaps/:id/dependencies/:depId": {
		async DELETE(req: Request) {
			const params = parseParams(req, IdWithDepParamSchema);
			if (!params) {
				return Response.json(
					{ error: "Invalid roadmap or dependency ID" },
					{ status: 400 },
				);
			}
			try {
				// Verify the dependency belongs to this roadmap by checking
				// that it appears in the roadmap's dependency list
				const repos = getRepositories();
				const roadmapDeps = await repos.roadmaps.listDependencies(params.id);
				const depBelongs = roadmapDeps.some((dep) => dep.id === params.depId);
				if (!depBelongs) {
					return Response.json(
						{ error: "Dependency not found in this roadmap" },
						{ status: 404 },
					);
				}

				await repos.roadmaps.deleteDependency(params.depId);

				broadcast(createRoadmapUpdatedEvent({ roadmapId: params.id }));

				return new Response(null, { status: 204 });
			} catch (error) {
				log.api.error("Failed to delete dependency:", error);
				return Response.json(
					{ error: error instanceof Error ? error.message : "Unknown error" },
					{ status: 500 },
				);
			}
		},
	},

	"/api/roadmaps/:id/generate": {
		async POST(req: Request) {
			const params = parseParams(req, IdParamSchema);
			if (!params) {
				return Response.json({ error: "Invalid roadmap ID" }, { status: 400 });
			}
			try {
				const repos = getRepositories();
				const roadmap = await repos.roadmaps.getRoadmap(params.id);
				if (!roadmap) {
					return Response.json({ error: "Roadmap not found" }, { status: 404 });
				}

				// Note: the user's original prompt is not stored on the roadmap record,
				// so retried generation loses that context.
				await startPersonaSessions(
					params.id,
					roadmap.title,
					roadmap.perspective,
				);

				broadcast(createRoadmapUpdatedEvent({ roadmapId: params.id }));

				log.api.success(
					`Started persona planning sessions for roadmap: ${params.id}`,
				);
				return Response.json({ roadmapId: params.id }, { status: 201 });
			} catch (error) {
				log.api.error("Failed to start AI planning session:", error);
				return Response.json(
					{ error: error instanceof Error ? error.message : "Unknown error" },
					{ status: 500 },
				);
			}
		},
	},

	/** @deprecated Legacy single-agent history endpoint. Kept for backward compatibility with roadmaps created before the multi-persona flow. New roadmaps use /api/roadmaps/:id/persona-sessions instead. */
	"/api/roadmaps/:id/history": {
		async GET(req: Request) {
			const params = parseParams(req, IdParamSchema);
			if (!params) {
				return Response.json({ error: "Invalid roadmap ID" }, { status: 400 });
			}
			try {
				const repos = getRepositories();
				const roadmap = await repos.roadmaps.getRoadmap(params.id);
				if (!roadmap) {
					return Response.json({ error: "Roadmap not found" }, { status: 404 });
				}

				const { messages, activeSessionId, activeSessionStatus } =
					await repos.conversations.getHistory("roadmap", params.id);

				return Response.json({
					roadmap,
					sessionId: activeSessionId,
					sessionStatus: activeSessionStatus,
					messages,
				});
			} catch (error) {
				log.api.error("Failed to get roadmap history:", error);
				return Response.json(
					{ error: error instanceof Error ? error.message : "Unknown error" },
					{ status: 500 },
				);
			}
		},
	},

	"/api/roadmaps/:id/persona-sessions": {
		async GET(req: Request) {
			const params = parseParams(req, IdParamSchema);
			if (!params) {
				return Response.json({ error: "Invalid roadmap ID" }, { status: 400 });
			}
			try {
				const projectRoot = getProjectRoot();
				const db = await getProjectDb(projectRoot);
				const repos = getRepositories();

				const roadmap = await repos.roadmaps.getRoadmap(params.id);
				if (!roadmap) {
					return Response.json({ error: "Roadmap not found" }, { status: 404 });
				}

				const personaRecords = await getPersonaRoadmaps(db, params.id);

				const personas = await Promise.all(
					personaRecords.map(async (record) => {
						const messages = record.sessionId
							? await repos.conversations.buildSessionMessages(record.sessionId)
							: [];
						return {
							persona: record.persona,
							sessionId: record.sessionId,
							status: record.status,
							roadmapData: record.roadmapData,
							messages,
						};
					}),
				);

				// Check for a synthesis session
				const roadmapSessions = await repos.sessions.getByContext(
					"roadmap",
					params.id,
				);
				const synthesisSession = roadmapSessions.find(
					(s) => s.agentRole === "synthesis",
				);

				let synthesis = null;
				if (synthesisSession) {
					const messages = await repos.conversations.buildSessionMessages(
						synthesisSession.id,
					);
					synthesis = {
						sessionId: synthesisSession.id,
						status: synthesisSession.status,
						messages,
					};
				}

				return Response.json({ personas, synthesis });
			} catch (error) {
				log.api.error("Failed to get persona sessions:", error);
				return Response.json(
					{ error: error instanceof Error ? error.message : "Unknown error" },
					{ status: 500 },
				);
			}
		},
	},

	"/api/roadmaps/:id/persona-roadmaps": {
		async GET(req: Request) {
			const params = parseParams(req, IdParamSchema);
			if (!params) {
				return Response.json({ error: "Invalid roadmap ID" }, { status: 400 });
			}
			try {
				const projectRoot = getProjectRoot();
				const db = await getProjectDb(projectRoot);
				const repos = getRepositories();

				const roadmap = await repos.roadmaps.getRoadmap(params.id);
				if (!roadmap) {
					return Response.json({ error: "Roadmap not found" }, { status: 404 });
				}

				const personaRoadmaps = await getPersonaRoadmaps(db, params.id);

				return Response.json(personaRoadmaps);
			} catch (error) {
				log.api.error("Failed to get persona roadmaps:", error);
				return Response.json(
					{ error: error instanceof Error ? error.message : "Unknown error" },
					{ status: 500 },
				);
			}
		},
	},
};
