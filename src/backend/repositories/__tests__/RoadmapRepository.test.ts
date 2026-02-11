/**
 * Tests for RoadmapRepository
 *
 * Tests all 23 public methods across 6 groups:
 * - Roadmap CRUD (5): createRoadmap, getRoadmap, listRoadmaps, updateRoadmap, deleteRoadmap
 * - Milestone CRUD (5): createMilestone, getMilestone, listMilestones, updateMilestone, deleteMilestone
 * - Initiative CRUD (7): createInitiative, getInitiative, listInitiatives, listInitiativesByRoadmap,
 *   findInitiativeByWorkflowId, updateInitiative, deleteInitiative
 * - Vision (2): getVisionDocument, upsertVisionDocument
 * - Dependencies (3): createDependency, listDependencies, deleteDependency
 * - Composite (1): getRoadmapWithDetails
 *
 * Uses createTestDb() in beforeEach for a fresh in-memory database per test.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { Kysely } from "kysely";
import type { ProjectDatabase } from "../../db/project/types";
import type { Repositories } from "../types";
import { createTestDb, destroyTestDb } from "./helper";

let db: Kysely<ProjectDatabase>;
let repos: Repositories;

beforeEach(async () => {
	const testDb = await createTestDb();
	db = testDb.db;
	repos = testDb.repos;
});

afterEach(async () => {
	await destroyTestDb(db);
});

// =============================================================================
// Helpers
// =============================================================================

/** Create a roadmap with sensible defaults for use as a prerequisite in other tests */
async function createTestRoadmap(title = "Test Roadmap") {
	return repos.roadmaps.createRoadmap({ title });
}

/** Create a milestone on a given roadmap */
async function createTestMilestone(
	roadmapId: string,
	sortOrder = 0,
	title = "Test Milestone",
) {
	return repos.roadmaps.createMilestone({ roadmapId, title, sortOrder });
}

/** Create an initiative on a given milestone/roadmap */
async function createTestInitiative(
	milestoneId: string,
	roadmapId: string,
	sortOrder = 0,
	title = "Test Initiative",
) {
	return repos.roadmaps.createInitiative({
		milestoneId,
		roadmapId,
		title,
		sortOrder,
	});
}

// =============================================================================
// Roadmap CRUD
// =============================================================================

describe("RoadmapRepository", () => {
	describe("Roadmap CRUD", () => {
		describe("createRoadmap", () => {
			test("creates a roadmap with correct fields and defaults", async () => {
				const roadmap = await repos.roadmaps.createRoadmap({
					title: "My Roadmap",
					description: "A description",
				});

				expect(roadmap.id).toMatch(/^roadmap_/);
				expect(roadmap.title).toBe("My Roadmap");
				expect(roadmap.description).toBe("A description");
				expect(roadmap.status).toBe("draft");
				expect(roadmap.currentSessionId).toBeUndefined();
				expect(typeof roadmap.createdAt).toBe("number");
				expect(typeof roadmap.updatedAt).toBe("number");
			});
		});

		describe("getRoadmap", () => {
			test("retrieves a roadmap by ID", async () => {
				const created = await createTestRoadmap("Find Me");

				const found = await repos.roadmaps.getRoadmap(created.id);

				expect(found).not.toBeNull();
				expect(found?.id).toBe(created.id);
				expect(found?.title).toBe("Find Me");
			});

			test("returns null for non-existent ID", async () => {
				const found = await repos.roadmaps.getRoadmap(
					"roadmap_nonexistent_000000",
				);

				expect(found).toBeNull();
			});
		});

		describe("listRoadmaps", () => {
			test("returns roadmaps ordered by updated_at descending", async () => {
				const first = await repos.roadmaps.createRoadmap({ title: "First" });
				await repos.roadmaps.createRoadmap({ title: "Second" });
				// Update the first one so its updated_at is most recent
				await repos.roadmaps.updateRoadmap(first.id, {
					title: "First Updated",
				});

				const list = await repos.roadmaps.listRoadmaps();

				expect(list).toHaveLength(2);
				expect(list[0]?.title).toBe("First Updated");
				expect(list[1]?.title).toBe("Second");
			});
		});

		describe("updateRoadmap", () => {
			test("partially updates a roadmap and preserves unchanged fields", async () => {
				const created = await repos.roadmaps.createRoadmap({
					title: "Original",
					description: "Original description",
				});

				const updated = await repos.roadmaps.updateRoadmap(created.id, {
					title: "Updated Title",
				});

				expect(updated.title).toBe("Updated Title");
				expect(updated.description).toBe("Original description");
				expect(updated.status).toBe("draft");
				expect(updated.updatedAt).toBeGreaterThanOrEqual(created.updatedAt);
			});
		});

		describe("deleteRoadmap", () => {
			test("transactionally cascades delete to milestones, initiatives, vision, and dependencies", async () => {
				// Build a full hierarchy
				const roadmap = await createTestRoadmap("To Delete");
				const milestone = await createTestMilestone(roadmap.id, 0);
				const initiative = await createTestInitiative(
					milestone.id,
					roadmap.id,
					0,
				);
				await repos.roadmaps.upsertVisionDocument(roadmap.id, "Vision content");
				await repos.roadmaps.createDependency({
					sourceType: "milestone",
					sourceId: milestone.id,
					targetType: "initiative",
					targetId: initiative.id,
				});

				// Delete the roadmap
				await repos.roadmaps.deleteRoadmap(roadmap.id);

				// Verify all child tables are empty
				expect(await repos.roadmaps.getRoadmap(roadmap.id)).toBeNull();
				expect(await repos.roadmaps.getMilestone(milestone.id)).toBeNull();
				expect(await repos.roadmaps.getInitiative(initiative.id)).toBeNull();
				expect(await repos.roadmaps.getVisionDocument(roadmap.id)).toBeNull();
				expect(await repos.roadmaps.listDependencies(roadmap.id)).toHaveLength(
					0,
				);
			});
		});
	});

	// ===========================================================================
	// Milestone CRUD
	// ===========================================================================

	describe("Milestone CRUD", () => {
		describe("createMilestone", () => {
			test("creates a milestone linked to a roadmap", async () => {
				const roadmap = await createTestRoadmap();

				const milestone = await repos.roadmaps.createMilestone({
					roadmapId: roadmap.id,
					title: "Phase 1",
					description: "First phase",
					sortOrder: 1,
				});

				expect(milestone.id).toMatch(/^milestone_/);
				expect(milestone.roadmapId).toBe(roadmap.id);
				expect(milestone.title).toBe("Phase 1");
				expect(milestone.description).toBe("First phase");
				expect(milestone.sortOrder).toBe(1);
				expect(typeof milestone.createdAt).toBe("number");
			});
		});

		describe("getMilestone", () => {
			test("retrieves a milestone by ID", async () => {
				const roadmap = await createTestRoadmap();
				const created = await createTestMilestone(roadmap.id, 0, "Find Me");

				const found = await repos.roadmaps.getMilestone(created.id);

				expect(found).not.toBeNull();
				expect(found?.id).toBe(created.id);
				expect(found?.title).toBe("Find Me");
			});
		});

		describe("listMilestones", () => {
			test("returns milestones ordered by sort_order ascending", async () => {
				const roadmap = await createTestRoadmap();
				await createTestMilestone(roadmap.id, 3, "Third");
				await createTestMilestone(roadmap.id, 1, "First");
				await createTestMilestone(roadmap.id, 2, "Second");

				const list = await repos.roadmaps.listMilestones(roadmap.id);

				expect(list).toHaveLength(3);
				expect(list[0]?.title).toBe("First");
				expect(list[1]?.title).toBe("Second");
				expect(list[2]?.title).toBe("Third");
			});

			test("only returns milestones for the specified roadmap", async () => {
				const roadmap1 = await createTestRoadmap("Roadmap 1");
				const roadmap2 = await createTestRoadmap("Roadmap 2");
				await createTestMilestone(roadmap1.id, 0, "R1 Milestone");
				await createTestMilestone(roadmap2.id, 0, "R2 Milestone");

				const list = await repos.roadmaps.listMilestones(roadmap1.id);

				expect(list).toHaveLength(1);
				expect(list[0]?.title).toBe("R1 Milestone");
			});
		});

		describe("updateMilestone", () => {
			test("partially updates a milestone", async () => {
				const roadmap = await createTestRoadmap();
				const created = await createTestMilestone(roadmap.id, 1, "Original");

				const updated = await repos.roadmaps.updateMilestone(created.id, {
					title: "Updated",
					sortOrder: 5,
				});

				expect(updated.title).toBe("Updated");
				expect(updated.sortOrder).toBe(5);
				expect(updated.roadmapId).toBe(roadmap.id);
			});
		});

		describe("deleteMilestone", () => {
			test("cascade deletes initiatives and dependencies under the milestone", async () => {
				const roadmap = await createTestRoadmap();
				const milestone = await createTestMilestone(roadmap.id, 0);
				const initiative1 = await createTestInitiative(
					milestone.id,
					roadmap.id,
					0,
					"Init 1",
				);
				const initiative2 = await createTestInitiative(
					milestone.id,
					roadmap.id,
					1,
					"Init 2",
				);

				// Create a dependency between the two initiatives
				await repos.roadmaps.createDependency({
					sourceType: "initiative",
					sourceId: initiative1.id,
					targetType: "initiative",
					targetId: initiative2.id,
				});

				await repos.roadmaps.deleteMilestone(milestone.id);

				// Milestone and initiatives should be gone
				expect(await repos.roadmaps.getMilestone(milestone.id)).toBeNull();
				expect(await repos.roadmaps.getInitiative(initiative1.id)).toBeNull();
				expect(await repos.roadmaps.getInitiative(initiative2.id)).toBeNull();
				// Dependencies should be cleaned up
				expect(await repos.roadmaps.listDependencies(roadmap.id)).toHaveLength(
					0,
				);
			});
		});
	});

	// ===========================================================================
	// Initiative CRUD
	// ===========================================================================

	describe("Initiative CRUD", () => {
		describe("createInitiative", () => {
			test("creates an initiative with correct defaults", async () => {
				const roadmap = await createTestRoadmap();
				const milestone = await createTestMilestone(roadmap.id, 0);

				const initiative = await repos.roadmaps.createInitiative({
					milestoneId: milestone.id,
					roadmapId: roadmap.id,
					title: "Build feature",
					description: "Feature description",
					sortOrder: 0,
				});

				expect(initiative.id).toMatch(/^initiative_/);
				expect(initiative.milestoneId).toBe(milestone.id);
				expect(initiative.roadmapId).toBe(roadmap.id);
				expect(initiative.title).toBe("Build feature");
				expect(initiative.description).toBe("Feature description");
				expect(initiative.status).toBe("not_started");
				expect(initiative.priority).toBe("medium");
				expect(initiative.progress).toBe(0);
				expect(initiative.workflowId).toBeUndefined();
				expect(initiative.size).toBeNull();
				expect(initiative.sortOrder).toBe(0);
			});
		});

		describe("getInitiative", () => {
			test("retrieves an initiative by ID", async () => {
				const roadmap = await createTestRoadmap();
				const milestone = await createTestMilestone(roadmap.id, 0);
				const created = await createTestInitiative(
					milestone.id,
					roadmap.id,
					0,
					"Find Me",
				);

				const found = await repos.roadmaps.getInitiative(created.id);

				expect(found).not.toBeNull();
				expect(found?.id).toBe(created.id);
				expect(found?.title).toBe("Find Me");
			});
		});

		describe("listInitiatives", () => {
			test("returns initiatives by milestoneId ordered by sort_order", async () => {
				const roadmap = await createTestRoadmap();
				const milestone = await createTestMilestone(roadmap.id, 0);
				await createTestInitiative(milestone.id, roadmap.id, 2, "Second");
				await createTestInitiative(milestone.id, roadmap.id, 0, "First");
				await createTestInitiative(milestone.id, roadmap.id, 1, "Middle");

				const list = await repos.roadmaps.listInitiatives(milestone.id);

				expect(list).toHaveLength(3);
				expect(list[0]?.title).toBe("First");
				expect(list[1]?.title).toBe("Middle");
				expect(list[2]?.title).toBe("Second");
			});
		});

		describe("listInitiativesByRoadmap", () => {
			test("returns all initiatives for a roadmap across milestones", async () => {
				const roadmap = await createTestRoadmap();
				const milestone1 = await createTestMilestone(roadmap.id, 0, "M1");
				const milestone2 = await createTestMilestone(roadmap.id, 1, "M2");
				await createTestInitiative(milestone1.id, roadmap.id, 1, "M1 Init");
				await createTestInitiative(milestone2.id, roadmap.id, 0, "M2 Init");

				const list = await repos.roadmaps.listInitiativesByRoadmap(roadmap.id);

				expect(list).toHaveLength(2);
				// Ordered by sort_order: 0 then 1
				expect(list[0]?.title).toBe("M2 Init");
				expect(list[1]?.title).toBe("M1 Init");
			});
		});

		describe("findInitiativeByWorkflowId", () => {
			test("finds an initiative linked to a workflow", async () => {
				const roadmap = await createTestRoadmap();
				const milestone = await createTestMilestone(roadmap.id, 0);
				const workflowId = "workflow_test_abc123";
				await repos.roadmaps.createInitiative({
					milestoneId: milestone.id,
					roadmapId: roadmap.id,
					title: "Linked Init",
					sortOrder: 0,
					workflowId,
				});

				const found =
					await repos.roadmaps.findInitiativeByWorkflowId(workflowId);

				expect(found).not.toBeNull();
				expect(found?.title).toBe("Linked Init");
				expect(found?.workflowId).toBe(workflowId);
			});

			test("returns null for an unlinked workflow", async () => {
				const found = await repos.roadmaps.findInitiativeByWorkflowId(
					"workflow_nonexistent_000000",
				);

				expect(found).toBeNull();
			});
		});

		describe("updateInitiative", () => {
			test("partially updates an initiative", async () => {
				const roadmap = await createTestRoadmap();
				const milestone = await createTestMilestone(roadmap.id, 0);
				const created = await createTestInitiative(
					milestone.id,
					roadmap.id,
					0,
					"Original",
				);

				const updated = await repos.roadmaps.updateInitiative(created.id, {
					title: "Updated",
					status: "in_progress",
					priority: "high",
					progress: 50,
				});

				expect(updated.title).toBe("Updated");
				expect(updated.status).toBe("in_progress");
				expect(updated.priority).toBe("high");
				expect(updated.progress).toBe(50);
				// Unchanged fields preserved
				expect(updated.milestoneId).toBe(milestone.id);
				expect(updated.roadmapId).toBe(roadmap.id);
			});
		});

		describe("deleteInitiative", () => {
			test("cascade deletes dependencies referencing the initiative", async () => {
				const roadmap = await createTestRoadmap();
				const milestone = await createTestMilestone(roadmap.id, 0);
				const init1 = await createTestInitiative(
					milestone.id,
					roadmap.id,
					0,
					"Init 1",
				);
				const init2 = await createTestInitiative(
					milestone.id,
					roadmap.id,
					1,
					"Init 2",
				);

				// Create a dependency where init1 is the source
				const dep = await repos.roadmaps.createDependency({
					sourceType: "initiative",
					sourceId: init1.id,
					targetType: "initiative",
					targetId: init2.id,
				});

				await repos.roadmaps.deleteInitiative(init1.id);

				// Initiative gone
				expect(await repos.roadmaps.getInitiative(init1.id)).toBeNull();
				// Dependency cleaned up
				const deps = await repos.roadmaps.listDependencies(roadmap.id);
				const depIds = deps.map((d) => d.id);
				expect(depIds).not.toContain(dep.id);
				// init2 still exists
				expect(await repos.roadmaps.getInitiative(init2.id)).not.toBeNull();
			});
		});
	});

	// ===========================================================================
	// Vision Document
	// ===========================================================================

	describe("Vision Document", () => {
		describe("getVisionDocument", () => {
			test("returns null when no vision document exists", async () => {
				const roadmap = await createTestRoadmap();

				const vision = await repos.roadmaps.getVisionDocument(roadmap.id);

				expect(vision).toBeNull();
			});
		});

		describe("upsertVisionDocument", () => {
			test("inserts a new vision document when none exists", async () => {
				const roadmap = await createTestRoadmap();

				const vision = await repos.roadmaps.upsertVisionDocument(
					roadmap.id,
					"# Vision\nOur product vision.",
				);

				expect(vision.id).toMatch(/^vision_/);
				expect(vision.roadmapId).toBe(roadmap.id);
				expect(vision.content).toBe("# Vision\nOur product vision.");
				expect(typeof vision.createdAt).toBe("number");
			});

			test("updates existing vision document without creating a duplicate", async () => {
				const roadmap = await createTestRoadmap();

				const first = await repos.roadmaps.upsertVisionDocument(
					roadmap.id,
					"Original content",
				);
				const second = await repos.roadmaps.upsertVisionDocument(
					roadmap.id,
					"Updated content",
				);

				// Same document (same ID), updated content
				expect(second.id).toBe(first.id);
				expect(second.content).toBe("Updated content");
				expect(second.updatedAt).toBeGreaterThanOrEqual(first.updatedAt);

				// Verify only one row exists by querying directly
				const rows = await db
					.selectFrom("vision_documents")
					.selectAll()
					.where("roadmap_id", "=", roadmap.id)
					.execute();
				expect(rows).toHaveLength(1);
			});
		});
	});

	// ===========================================================================
	// Dependencies
	// ===========================================================================

	describe("Dependencies", () => {
		describe("createDependency", () => {
			test("creates a dependency with polymorphic source/target types", async () => {
				const roadmap = await createTestRoadmap();
				const milestone = await createTestMilestone(roadmap.id, 0);
				const initiative = await createTestInitiative(
					milestone.id,
					roadmap.id,
					0,
				);

				const dep = await repos.roadmaps.createDependency({
					sourceType: "milestone",
					sourceId: milestone.id,
					targetType: "initiative",
					targetId: initiative.id,
				});

				expect(dep.id).toMatch(/^dep_/);
				expect(dep.sourceType).toBe("milestone");
				expect(dep.sourceId).toBe(milestone.id);
				expect(dep.targetType).toBe("initiative");
				expect(dep.targetId).toBe(initiative.id);
				expect(typeof dep.createdAt).toBe("number");
			});
		});

		describe("listDependencies", () => {
			test("returns dependencies for a roadmap by joining through milestones and initiatives", async () => {
				const roadmap = await createTestRoadmap();
				const milestone1 = await createTestMilestone(roadmap.id, 0, "M1");
				const milestone2 = await createTestMilestone(roadmap.id, 1, "M2");
				const initiative = await createTestInitiative(
					milestone1.id,
					roadmap.id,
					0,
				);

				// Create two dependencies
				await repos.roadmaps.createDependency({
					sourceType: "milestone",
					sourceId: milestone1.id,
					targetType: "milestone",
					targetId: milestone2.id,
				});
				await repos.roadmaps.createDependency({
					sourceType: "initiative",
					sourceId: initiative.id,
					targetType: "milestone",
					targetId: milestone2.id,
				});

				const deps = await repos.roadmaps.listDependencies(roadmap.id);

				expect(deps).toHaveLength(2);
			});
		});

		describe("deleteDependency", () => {
			test("removes a dependency by ID", async () => {
				const roadmap = await createTestRoadmap();
				const milestone1 = await createTestMilestone(roadmap.id, 0, "M1");
				const milestone2 = await createTestMilestone(roadmap.id, 1, "M2");

				const dep = await repos.roadmaps.createDependency({
					sourceType: "milestone",
					sourceId: milestone1.id,
					targetType: "milestone",
					targetId: milestone2.id,
				});

				await repos.roadmaps.deleteDependency(dep.id);

				const deps = await repos.roadmaps.listDependencies(roadmap.id);
				expect(deps).toHaveLength(0);
			});
		});
	});

	// ===========================================================================
	// Composite Queries
	// ===========================================================================

	describe("Composite Queries", () => {
		describe("getRoadmapWithDetails", () => {
			test("returns full hierarchy with milestones, initiatives, vision, and dependencies", async () => {
				// Build a complete hierarchy
				const roadmap = await createTestRoadmap("Full Roadmap");
				const milestone1 = await createTestMilestone(roadmap.id, 0, "Phase 1");
				const milestone2 = await createTestMilestone(roadmap.id, 1, "Phase 2");
				const init1 = await createTestInitiative(
					milestone1.id,
					roadmap.id,
					0,
					"Init A",
				);
				const init2 = await createTestInitiative(
					milestone2.id,
					roadmap.id,
					1,
					"Init B",
				);
				await repos.roadmaps.upsertVisionDocument(roadmap.id, "The vision");
				await repos.roadmaps.createDependency({
					sourceType: "initiative",
					sourceId: init1.id,
					targetType: "initiative",
					targetId: init2.id,
				});

				const details = await repos.roadmaps.getRoadmapWithDetails(roadmap.id);

				expect(details).not.toBeNull();
				expect(details?.roadmap.id).toBe(roadmap.id);
				expect(details?.roadmap.title).toBe("Full Roadmap");

				// Milestones ordered by sort_order
				expect(details?.milestones).toHaveLength(2);
				expect(details?.milestones[0]?.title).toBe("Phase 1");
				expect(details?.milestones[1]?.title).toBe("Phase 2");

				// Initiatives across all milestones
				expect(details?.initiatives).toHaveLength(2);

				// Vision document
				expect(details?.visionDocument).not.toBeNull();
				expect(details?.visionDocument?.content).toBe("The vision");

				// Dependencies
				expect(details?.dependencies).toHaveLength(1);
				expect(details?.dependencies[0]?.sourceId).toBe(init1.id);
				expect(details?.dependencies[0]?.targetId).toBe(init2.id);
			});

			test("returns null for non-existent roadmap ID", async () => {
				const details = await repos.roadmaps.getRoadmapWithDetails(
					"roadmap_nonexistent_000000",
				);

				expect(details).toBeNull();
			});
		});
	});
});
