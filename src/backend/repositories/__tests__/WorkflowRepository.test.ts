/**
 * Tests for WorkflowRepository
 *
 * Tests all 11 public methods: create, getById, list, updateStatus,
 * setCurrentSession, setAwaitingApproval, clearAwaitingApproval, archive,
 * transitionStage, setBaseBranch, setSkippedStages.
 * Includes domain mapping edge cases for SQLite bool→JS bool, JSON parse,
 * and null→undefined conversions.
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

describe("WorkflowRepository", () => {
	describe("create", () => {
		test("returns a Workflow with camelCase fields and correct types", async () => {
			const workflow = await repos.workflows.create({
				title: "Test workflow",
				description: "A description",
			});

			expect(workflow.id).toMatch(/^workflow_/);
			expect(workflow.title).toBe("Test workflow");
			expect(workflow.description).toBe("A description");
			expect(workflow.status).toBe("scoping");
			expect(workflow.priority).toBe("medium");
			expect(workflow.currentSessionId).toBeUndefined();
			expect(workflow.awaitingApproval).toBe(false);
			expect(typeof workflow.awaitingApproval).toBe("boolean");
			expect(workflow.archived).toBe(false);
			expect(typeof workflow.archived).toBe("boolean");
			expect(workflow.pendingArtifactType).toBeUndefined();
			expect(workflow.baseBranch).toBeUndefined();
			expect(workflow.skippedStages).toEqual([]);
			expect(typeof workflow.createdAt).toBe("number");
			expect(typeof workflow.updatedAt).toBe("number");
			expect(workflow.createdAt).toBe(workflow.updatedAt);
		});

		test("creates with optional description omitted resulting in undefined", async () => {
			const workflow = await repos.workflows.create({
				title: "No description",
			});

			expect(workflow.description).toBeUndefined();
		});

		test("creates with explicit status and priority", async () => {
			const workflow = await repos.workflows.create({
				title: "Custom workflow",
				status: "planning",
				priority: "high",
			});

			expect(workflow.status).toBe("planning");
			expect(workflow.priority).toBe("high");
		});

		test("creates with skippedStages", async () => {
			const workflow = await repos.workflows.create({
				title: "Quick path",
				skippedStages: ["researching", "planning"],
			});

			expect(workflow.skippedStages).toEqual(["researching", "planning"]);
		});
	});

	describe("getById", () => {
		test("retrieves a workflow by ID with all fields", async () => {
			const created = await repos.workflows.create({
				title: "Find me",
				description: "Findable workflow",
			});

			const found = await repos.workflows.getById(created.id);

			expect(found).not.toBeNull();
			expect(found?.id).toBe(created.id);
			expect(found?.title).toBe("Find me");
			expect(found?.description).toBe("Findable workflow");
			expect(found?.status).toBe("scoping");
			expect(found?.priority).toBe("medium");
			expect(found?.createdAt).toBe(created.createdAt);
			expect(found?.updatedAt).toBe(created.updatedAt);
		});

		test("returns null for non-existent ID", async () => {
			const found = await repos.workflows.getById(
				"workflow_nonexistent_000000",
			);

			expect(found).toBeNull();
		});
	});

	describe("list", () => {
		test("returns only non-archived workflows", async () => {
			const wf1 = await repos.workflows.create({ title: "Active 1" });
			const wf2 = await repos.workflows.create({ title: "Active 2" });
			const wf3 = await repos.workflows.create({ title: "Archived one" });
			await repos.workflows.archive(wf3.id);

			const workflows = await repos.workflows.list();

			expect(workflows).toHaveLength(2);
			const ids = workflows.map((w) => w.id);
			expect(ids).toContain(wf1.id);
			expect(ids).toContain(wf2.id);
			expect(ids).not.toContain(wf3.id);
		});

		test("returns empty array when no workflows exist", async () => {
			const workflows = await repos.workflows.list();

			expect(workflows).toHaveLength(0);
		});

		test("orders by updated_at desc by default", async () => {
			const wf1 = await repos.workflows.create({ title: "First" });
			const wf2 = await repos.workflows.create({ title: "Second" });
			// Update wf1 so it has a newer updated_at
			await repos.workflows.updateStatus(wf1.id, "planning");

			const workflows = await repos.workflows.list();

			expect(workflows[0]?.id).toBe(wf1.id);
			expect(workflows[1]?.id).toBe(wf2.id);
		});
	});

	describe("updateStatus", () => {
		test("updates status and reflects in getById", async () => {
			const created = await repos.workflows.create({ title: "Status test" });

			await repos.workflows.updateStatus(created.id, "planning");

			const found = await repos.workflows.getById(created.id);
			expect(found?.status).toBe("planning");
			expect(found?.updatedAt).toBeGreaterThanOrEqual(created.updatedAt);
		});
	});

	describe("setCurrentSession", () => {
		test("sets current session ID and reflects in getById", async () => {
			const created = await repos.workflows.create({
				title: "Session test",
			});
			const sessionId = "session_test_abc123";

			await repos.workflows.setCurrentSession(created.id, sessionId);

			const found = await repos.workflows.getById(created.id);
			expect(found?.currentSessionId).toBe(sessionId);
		});

		test("clears current session when set to null", async () => {
			const created = await repos.workflows.create({
				title: "Session clear test",
			});
			await repos.workflows.setCurrentSession(
				created.id,
				"session_test_abc123",
			);

			await repos.workflows.setCurrentSession(created.id, null);

			const found = await repos.workflows.getById(created.id);
			expect(found?.currentSessionId).toBeUndefined();
		});
	});

	describe("setAwaitingApproval", () => {
		test("sets awaitingApproval to true with pending artifact type", async () => {
			const created = await repos.workflows.create({
				title: "Approval test",
			});

			await repos.workflows.setAwaitingApproval(created.id, "scope_card");

			const found = await repos.workflows.getById(created.id);
			expect(found?.awaitingApproval).toBe(true);
			expect(typeof found?.awaitingApproval).toBe("boolean");
			expect(found?.pendingArtifactType).toBe("scope_card");
		});
	});

	describe("clearAwaitingApproval", () => {
		test("clears awaitingApproval back to false", async () => {
			const created = await repos.workflows.create({
				title: "Clear approval test",
			});
			await repos.workflows.setAwaitingApproval(created.id, "plan");

			await repos.workflows.clearAwaitingApproval(created.id);

			const found = await repos.workflows.getById(created.id);
			expect(found?.awaitingApproval).toBe(false);
			expect(typeof found?.awaitingApproval).toBe("boolean");
			expect(found?.pendingArtifactType).toBeUndefined();
		});
	});

	describe("archive", () => {
		test("sets archived to true as a boolean", async () => {
			const created = await repos.workflows.create({
				title: "Archive test",
			});

			await repos.workflows.archive(created.id);

			const found = await repos.workflows.getById(created.id);
			expect(found?.archived).toBe(true);
			expect(typeof found?.archived).toBe("boolean");
		});

		test("archived workflow is excluded from list", async () => {
			const wf = await repos.workflows.create({ title: "Will archive" });

			await repos.workflows.archive(wf.id);

			const workflows = await repos.workflows.list();
			const ids = workflows.map((w) => w.id);
			expect(ids).not.toContain(wf.id);
		});
	});

	describe("transitionStage", () => {
		test("updates status and clears approval state", async () => {
			const created = await repos.workflows.create({
				title: "Transition test",
			});
			await repos.workflows.setAwaitingApproval(created.id, "scope_card");

			await repos.workflows.transitionStage(
				created.id,
				"researching",
				"session_new_abc123",
			);

			const found = await repos.workflows.getById(created.id);
			expect(found?.status).toBe("researching");
			expect(found?.currentSessionId).toBe("session_new_abc123");
			expect(found?.awaitingApproval).toBe(false);
			expect(found?.pendingArtifactType).toBeUndefined();
		});

		test("transitions with null session ID", async () => {
			const created = await repos.workflows.create({
				title: "Transition null session",
			});

			await repos.workflows.transitionStage(created.id, "planning", null);

			const found = await repos.workflows.getById(created.id);
			expect(found?.status).toBe("planning");
			expect(found?.currentSessionId).toBeUndefined();
		});
	});

	describe("setBaseBranch", () => {
		test("sets base branch and persists via getById", async () => {
			const created = await repos.workflows.create({
				title: "Branch test",
			});

			await repos.workflows.setBaseBranch(created.id, "main");

			const found = await repos.workflows.getById(created.id);
			expect(found?.baseBranch).toBe("main");
		});
	});

	describe("setSkippedStages", () => {
		test("sets skippedStages array and retrieves as parsed JS array", async () => {
			const created = await repos.workflows.create({
				title: "Skipped stages test",
			});

			await repos.workflows.setSkippedStages(created.id, [
				"researching",
				"planning",
			]);

			const found = await repos.workflows.getById(created.id);
			expect(found?.skippedStages).toEqual(["researching", "planning"]);
			expect(Array.isArray(found?.skippedStages)).toBe(true);
		});

		test("default skippedStages is empty array for new workflow", async () => {
			const created = await repos.workflows.create({
				title: "Default stages test",
			});

			const found = await repos.workflows.getById(created.id);
			expect(found?.skippedStages).toEqual([]);
		});
	});

	describe("domain mapping edge cases", () => {
		test("maps raw SQLite integer booleans to JS booleans", async () => {
			const now = Date.now();
			// Insert a raw row with integer 1 for archived and awaiting_approval
			await db
				.insertInto("workflows")
				.values({
					id: "workflow_raw_test001",
					title: "Raw insert test",
					description: null,
					status: "scoping",
					priority: "medium",
					current_session_id: null,
					awaiting_approval: 1,
					archived: 1,
					pending_artifact_type: "scope_card",
					base_branch: null,
					skipped_stages: JSON.stringify(["researching", "review"]),
					created_at: now,
					updated_at: now,
				})
				.execute();

			const found = await repos.workflows.getById("workflow_raw_test001");

			expect(found).not.toBeNull();
			// Boolean mapping
			expect(found?.archived).toBe(true);
			expect(typeof found?.archived).toBe("boolean");
			expect(found?.awaitingApproval).toBe(true);
			expect(typeof found?.awaitingApproval).toBe("boolean");
			// Null → undefined mapping
			expect(found?.description).toBeUndefined();
			expect(found?.currentSessionId).toBeUndefined();
			expect(found?.baseBranch).toBeUndefined();
			// JSON string → parsed array
			expect(found?.skippedStages).toEqual(["researching", "review"]);
			expect(Array.isArray(found?.skippedStages)).toBe(true);
		});

		test("maps null skipped_stages to empty array", async () => {
			const now = Date.now();
			// Insert a raw row with a falsy skipped_stages
			// Note: the column is typed as string in the DB, but toWorkflow handles
			// falsy values by returning []. We insert an empty string to test this.
			await db
				.insertInto("workflows")
				.values({
					id: "workflow_raw_test002",
					title: "Null stages test",
					description: null,
					status: "scoping",
					priority: "medium",
					current_session_id: null,
					awaiting_approval: 0,
					archived: 0,
					pending_artifact_type: null,
					base_branch: null,
					skipped_stages: "",
					created_at: now,
					updated_at: now,
				})
				.execute();

			const found = await repos.workflows.getById("workflow_raw_test002");

			// Empty string is falsy, so toWorkflow returns []
			expect(found?.skippedStages).toEqual([]);
		});
	});
});
