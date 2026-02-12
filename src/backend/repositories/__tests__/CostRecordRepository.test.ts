/**
 * Tests for CostRecordRepository
 *
 * Tests all 4 core public methods: insert, sumByContext, sumByContextIds, getTotalWorkflowCost.
 * Uses createTestDb() in beforeEach for a fresh in-memory database per test.
 * Prerequisite workflow and session records are inserted directly into the DB
 * since cost records reference context IDs.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { Kysely } from "kysely";
import type { ProjectDatabase } from "../../db/project/types";
import { ids } from "../../utils/ids";
import type { Repositories } from "../types";
import { createTestDb, destroyTestDb } from "./helper";

let db: Kysely<ProjectDatabase>;
let repos: Repositories;

// Shared prerequisite IDs — regenerated per test via beforeEach
let workflowId: string;
let sessionId: string;

beforeEach(async () => {
	const testDb = await createTestDb();
	db = testDb.db;
	repos = testDb.repos;

	// Create prerequisite workflow and session records
	workflowId = ids.workflow();
	sessionId = ids.session();
	const now = Date.now();

	await db
		.insertInto("workflows")
		.values({
			id: workflowId,
			title: "Test Workflow",
			status: "in_progress",
			priority: "medium",
			awaiting_approval: 0,
			archived: 0,
			skipped_stages: "[]",
			created_at: now,
			updated_at: now,
		})
		.execute();

	await db
		.insertInto("sessions")
		.values({
			id: sessionId,
			context_type: "workflow",
			context_id: workflowId,
			agent_role: "executor",
			status: "active",
			created_at: now,
			updated_at: now,
		})
		.execute();
});

afterEach(async () => {
	await destroyTestDb(db);
});

describe("CostRecordRepository", () => {
	describe("insert", () => {
		test("creates a cost record that persists in the database", async () => {
			const costId = ids.cost();
			const turnId = ids.turn();
			const now = Math.floor(Date.now() / 1000);

			await repos.costRecords.insert({
				id: costId,
				contextType: "workflow",
				contextId: workflowId,
				turnId,
				sessionId,
				modelId: "claude-sonnet-4-20250514",
				agentRole: "executor",
				promptTokens: 1000,
				completionTokens: 500,
				costUsd: 0.015,
				createdAt: now,
			});

			// Verify directly via DB query
			const row = await db
				.selectFrom("cost_records")
				.selectAll()
				.where("id", "=", costId)
				.executeTakeFirst();

			expect(row).not.toBeUndefined();
			expect(row?.id).toBe(costId);
			expect(row?.context_type).toBe("workflow");
			expect(row?.context_id).toBe(workflowId);
			expect(row?.turn_id).toBe(turnId);
			expect(row?.session_id).toBe(sessionId);
			expect(row?.model_id).toBe("claude-sonnet-4-20250514");
			expect(row?.agent_role).toBe("executor");
			expect(row?.prompt_tokens).toBe(1000);
			expect(row?.completion_tokens).toBe(500);
			expect(row?.cost_usd).toBeCloseTo(0.015);
			expect(row?.created_at).toBe(now);
		});
	});

	describe("sumByContext", () => {
		test("returns correct total cost for matching context records", async () => {
			const now = Math.floor(Date.now() / 1000);

			// Insert 3 cost records for the same workflow context
			await repos.costRecords.insert({
				id: ids.cost(),
				contextType: "workflow",
				contextId: workflowId,
				turnId: ids.turn(),
				sessionId,
				modelId: "claude-sonnet-4-20250514",
				agentRole: "executor",
				promptTokens: 100,
				completionTokens: 50,
				costUsd: 0.01,
				createdAt: now,
			});

			await repos.costRecords.insert({
				id: ids.cost(),
				contextType: "workflow",
				contextId: workflowId,
				turnId: ids.turn(),
				sessionId,
				modelId: "claude-sonnet-4-20250514",
				agentRole: "executor",
				promptTokens: 200,
				completionTokens: 100,
				costUsd: 0.02,
				createdAt: now + 1,
			});

			await repos.costRecords.insert({
				id: ids.cost(),
				contextType: "workflow",
				contextId: workflowId,
				turnId: ids.turn(),
				sessionId,
				modelId: "claude-sonnet-4-20250514",
				agentRole: "planner",
				promptTokens: 300,
				completionTokens: 150,
				costUsd: 0.03,
				createdAt: now + 2,
			});

			const total = await repos.costRecords.sumByContext(
				"workflow",
				workflowId,
			);

			expect(total).toBeCloseTo(0.06);

			// Also verify token counts persisted correctly via DB query
			const rows = await db
				.selectFrom("cost_records")
				.selectAll()
				.where("context_type", "=", "workflow")
				.where("context_id", "=", workflowId)
				.execute();

			expect(rows).toHaveLength(3);
			const totalPromptTokens = rows.reduce(
				(sum, r) => sum + r.prompt_tokens,
				0,
			);
			const totalCompletionTokens = rows.reduce(
				(sum, r) => sum + r.completion_tokens,
				0,
			);
			expect(totalPromptTokens).toBe(600);
			expect(totalCompletionTokens).toBe(300);
		});

		test("returns 0 for non-existent context", async () => {
			const total = await repos.costRecords.sumByContext(
				"workflow",
				"workflow_nonexistent_000000",
			);

			expect(total).toBe(0);
		});
	});

	describe("sumByContextIds", () => {
		test("returns correct total across multiple context IDs", async () => {
			const workflowId2 = ids.workflow();
			const now = Math.floor(Date.now() / 1000);

			// Create second workflow
			await db
				.insertInto("workflows")
				.values({
					id: workflowId2,
					title: "Second Workflow",
					status: "in_progress",
					priority: "medium",
					awaiting_approval: 0,
					archived: 0,
					skipped_stages: "[]",
					created_at: Date.now(),
					updated_at: Date.now(),
				})
				.execute();

			// Insert records for first workflow context
			await repos.costRecords.insert({
				id: ids.cost(),
				contextType: "workflow",
				contextId: workflowId,
				turnId: ids.turn(),
				sessionId,
				modelId: "claude-sonnet-4-20250514",
				agentRole: "executor",
				promptTokens: 100,
				completionTokens: 50,
				costUsd: 0.01,
				createdAt: now,
			});

			await repos.costRecords.insert({
				id: ids.cost(),
				contextType: "workflow",
				contextId: workflowId,
				turnId: ids.turn(),
				sessionId,
				modelId: "claude-sonnet-4-20250514",
				agentRole: "executor",
				promptTokens: 200,
				completionTokens: 100,
				costUsd: 0.02,
				createdAt: now + 1,
			});

			// Insert records for second workflow context
			await repos.costRecords.insert({
				id: ids.cost(),
				contextType: "workflow",
				contextId: workflowId2,
				turnId: ids.turn(),
				sessionId,
				modelId: "claude-sonnet-4-20250514",
				agentRole: "planner",
				promptTokens: 500,
				completionTokens: 250,
				costUsd: 0.05,
				createdAt: now + 2,
			});

			const total = await repos.costRecords.sumByContextIds("workflow", [
				workflowId,
				workflowId2,
			]);

			expect(total).toBeCloseTo(0.08);
		});

		test("returns 0 for empty array input", async () => {
			const total = await repos.costRecords.sumByContextIds("workflow", []);

			expect(total).toBe(0);
		});
	});

	describe("getTotalWorkflowCost", () => {
		test("sums across workflow and subtask records", async () => {
			const subtaskId1 = ids.subtask();
			const subtaskId2 = ids.subtask();
			const now = Math.floor(Date.now() / 1000);

			// Insert cost record for the workflow context
			await repos.costRecords.insert({
				id: ids.cost(),
				contextType: "workflow",
				contextId: workflowId,
				turnId: ids.turn(),
				sessionId,
				modelId: "claude-sonnet-4-20250514",
				agentRole: "executor",
				promptTokens: 1000,
				completionTokens: 500,
				costUsd: 0.1,
				createdAt: now,
			});

			// Insert cost records for subtask contexts
			await repos.costRecords.insert({
				id: ids.cost(),
				contextType: "subtask",
				contextId: subtaskId1,
				turnId: ids.turn(),
				sessionId,
				modelId: "claude-sonnet-4-20250514",
				agentRole: "executor",
				promptTokens: 200,
				completionTokens: 100,
				costUsd: 0.02,
				createdAt: now + 1,
			});

			await repos.costRecords.insert({
				id: ids.cost(),
				contextType: "subtask",
				contextId: subtaskId2,
				turnId: ids.turn(),
				sessionId,
				modelId: "claude-sonnet-4-20250514",
				agentRole: "executor",
				promptTokens: 300,
				completionTokens: 150,
				costUsd: 0.03,
				createdAt: now + 2,
			});

			const total = await repos.costRecords.getTotalWorkflowCost(workflowId, [
				subtaskId1,
				subtaskId2,
			]);

			expect(total).toBeCloseTo(0.15);
		});

		test("sums only workflow records when no subtask IDs provided", async () => {
			const now = Math.floor(Date.now() / 1000);

			// Insert cost records for the workflow context
			await repos.costRecords.insert({
				id: ids.cost(),
				contextType: "workflow",
				contextId: workflowId,
				turnId: ids.turn(),
				sessionId,
				modelId: "claude-sonnet-4-20250514",
				agentRole: "executor",
				promptTokens: 1000,
				completionTokens: 500,
				costUsd: 0.1,
				createdAt: now,
			});

			await repos.costRecords.insert({
				id: ids.cost(),
				contextType: "workflow",
				contextId: workflowId,
				turnId: ids.turn(),
				sessionId,
				modelId: "claude-sonnet-4-20250514",
				agentRole: "planner",
				promptTokens: 500,
				completionTokens: 250,
				costUsd: 0.05,
				createdAt: now + 1,
			});

			// Insert a subtask record that should NOT be included
			await repos.costRecords.insert({
				id: ids.cost(),
				contextType: "subtask",
				contextId: ids.subtask(),
				turnId: ids.turn(),
				sessionId,
				modelId: "claude-sonnet-4-20250514",
				agentRole: "executor",
				promptTokens: 9999,
				completionTokens: 9999,
				costUsd: 99.99,
				createdAt: now + 2,
			});

			const total = await repos.costRecords.getTotalWorkflowCost(
				workflowId,
				[],
			);

			// Should only include the two workflow records, not the subtask
			expect(total).toBeCloseTo(0.15);
		});
	});
});
