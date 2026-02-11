/**
 * Tests for ArtifactRepository
 *
 * Part 1: ScopeCard, ResearchCard, Plan — CRUD, ordering, status updates,
 * cascade deletes, and JSON/Zod round-trip validation for all JSON fields.
 *
 * Part 2: ReviewCard, ReviewComment — CRUD, status/completion updates,
 * turn_id linking, reset, cascade delete (deleteReviewCardsByWorkflow),
 * and getPendingArtifact across all artifact types.
 *
 * Uses createTestDb() in beforeEach for a fresh in-memory database per test.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { Kysely } from "kysely";
import type { ProjectDatabase } from "../../db/project/types";
import type { Repositories } from "../types";
import { createTestDb, destroyTestDb } from "./helper";

// =============================================================================
// Minimal Valid JSON Fixtures
// =============================================================================

/** ScopeListSchema — z.array(z.string()) */
const SCOPE_IN_SCOPE = ["Add user login", "Add session management"];
const SCOPE_OUT_OF_SCOPE = ["OAuth providers", "Two-factor auth"];
const SCOPE_CONSTRAINTS = ["Must use existing auth library"];

/** KeyFilesJsonSchema — z.array(z.object({ path, purpose, lineRanges? })) */
const KEY_FILES = [
	{ path: "src/auth/login.ts", purpose: "Handles login flow" },
	{
		path: "src/auth/session.ts",
		purpose: "Session management",
		lineRanges: "1-50",
	},
];

/** PatternsJsonSchema — z.array(z.object({ category, description, example, locations })) */
const PATTERNS = [
	{
		category: "error-handling",
		description: "Uses AppError for all thrown errors",
		example: "throw new AppError('message', ErrorCode.NOT_FOUND)",
		locations: ["src/services/UserService.ts", "src/services/AuthService.ts"],
	},
];

/** DependenciesJsonSchema — z.array(z.object({ name, purpose, usageExample })) */
const DEPENDENCIES = [
	{
		name: "bcrypt",
		purpose: "Password hashing",
		usageExample: "await bcrypt.hash(password, 10)",
	},
];

/** IntegrationPointsJsonSchema — z.array(z.object({ location, description, existingCode })) */
const INTEGRATION_POINTS = [
	{
		location: "src/routes/auth.ts",
		description: "Auth route handler",
		existingCode: "router.post('/login', handler)",
	},
];

/** ChallengesJsonSchema — z.array(z.object({ issue, mitigation })) */
const CHALLENGES = [
	{
		issue: "Rate limiting not implemented",
		mitigation: "Add express-rate-limit middleware",
	},
];

/** RecommendationsJsonSchema — z.array(z.string()) */
const RECOMMENDATIONS = [
	"Use repository pattern for data access",
	"Add integration tests for auth flow",
];

/** PulsesJsonSchema — z.array(z.object({ id, title, description, expectedChanges, estimatedSize, dependsOn? })) */
const PULSE_1 = {
	id: "pulse_001",
	title: "Add login endpoint",
	description: "Create POST /login route",
	expectedChanges: ["src/routes/auth.ts", "src/services/AuthService.ts"],
	estimatedSize: "medium" as const,
};

const PULSE_2 = {
	id: "pulse_002",
	title: "Add session store",
	description: "Implement Redis session storage",
	expectedChanges: ["src/session/RedisStore.ts"],
	estimatedSize: "small" as const,
	dependsOn: ["pulse_001"],
};

const PULSES = [PULSE_1, PULSE_2];

// =============================================================================
// Test Setup
// =============================================================================

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

/** Create a prerequisite workflow for artifact tests */
async function createWorkflow(): Promise<string> {
	const workflow = await repos.workflows.create({ title: "Test workflow" });
	return workflow.id;
}

// =============================================================================
// ScopeCard Tests
// =============================================================================

describe("ArtifactRepository", () => {
	describe("ScopeCard", () => {
		test("createScopeCard with all JSON fields returns parsed JSON (not strings)", async () => {
			const workflowId = await createWorkflow();

			const scopeCard = await repos.artifacts.createScopeCard({
				workflowId,
				title: "Auth scope",
				description: "Authentication feature scope",
				inScope: SCOPE_IN_SCOPE,
				outOfScope: SCOPE_OUT_OF_SCOPE,
				constraints: SCOPE_CONSTRAINTS,
				recommendedPath: "full",
				rationale: "Complex feature needs full path",
			});

			expect(scopeCard.id).toMatch(/^scope_/);
			expect(scopeCard.workflowId).toBe(workflowId);
			expect(scopeCard.title).toBe("Auth scope");
			expect(scopeCard.description).toBe("Authentication feature scope");
			expect(scopeCard.inScope).toEqual(SCOPE_IN_SCOPE);
			expect(Array.isArray(scopeCard.inScope)).toBe(true);
			expect(scopeCard.outOfScope).toEqual(SCOPE_OUT_OF_SCOPE);
			expect(Array.isArray(scopeCard.outOfScope)).toBe(true);
			expect(scopeCard.constraints).toEqual(SCOPE_CONSTRAINTS);
			expect(Array.isArray(scopeCard.constraints)).toBe(true);
			expect(scopeCard.recommendedPath).toBe("full");
			expect(scopeCard.rationale).toBe("Complex feature needs full path");
			expect(scopeCard.status).toBe("pending");
			expect(typeof scopeCard.createdAt).toBe("number");
		});

		test("getLatestScopeCard returns the most recently created scope card", async () => {
			const workflowId = await createWorkflow();

			const first = await repos.artifacts.createScopeCard({
				workflowId,
				title: "First scope",
				description: "Created first",
				inScope: ["item1"],
				outOfScope: ["item2"],
				recommendedPath: "quick",
			});

			// Backdate first record so second has a strictly later created_at
			await db
				.updateTable("scope_cards")
				.set({ created_at: first.createdAt - 1000 })
				.where("id", "=", first.id)
				.execute();

			const second = await repos.artifacts.createScopeCard({
				workflowId,
				title: "Second scope",
				description: "Created second",
				inScope: ["item3"],
				outOfScope: ["item4"],
				recommendedPath: "full",
			});

			const latest = await repos.artifacts.getLatestScopeCard(workflowId);

			expect(latest).not.toBeNull();
			expect(latest?.id).toBe(second.id);
			expect(latest?.title).toBe("Second scope");
		});

		test("getAllScopeCards returns all scope cards ordered by created_at asc", async () => {
			const workflowId = await createWorkflow();

			const first = await repos.artifacts.createScopeCard({
				workflowId,
				title: "First",
				description: "First scope",
				inScope: ["a"],
				outOfScope: ["b"],
				recommendedPath: "quick",
			});

			// Backdate first record to guarantee ordering
			await db
				.updateTable("scope_cards")
				.set({ created_at: first.createdAt - 1000 })
				.where("id", "=", first.id)
				.execute();

			const second = await repos.artifacts.createScopeCard({
				workflowId,
				title: "Second",
				description: "Second scope",
				inScope: ["c"],
				outOfScope: ["d"],
				recommendedPath: "full",
			});

			const all = await repos.artifacts.getAllScopeCards(workflowId);

			expect(all).toHaveLength(2);
			expect(all[0]?.id).toBe(first.id);
			expect(all[1]?.id).toBe(second.id);
		});

		test("updateScopeCardStatus changes status and persists", async () => {
			const workflowId = await createWorkflow();

			const scopeCard = await repos.artifacts.createScopeCard({
				workflowId,
				title: "Status test",
				description: "Will be approved",
				inScope: ["x"],
				outOfScope: ["y"],
				recommendedPath: "quick",
			});

			expect(scopeCard.status).toBe("pending");

			await repos.artifacts.updateScopeCardStatus(scopeCard.id, "approved");

			const latest = await repos.artifacts.getLatestScopeCard(workflowId);
			expect(latest?.status).toBe("approved");
		});

		test("JSON round-trip: scope arrays survive create and read back", async () => {
			const workflowId = await createWorkflow();

			const inScope = ["Feature A", "Feature B", "Feature C"];
			const outOfScope = ["Feature X", "Feature Y"];
			const constraints = [
				"Must be backwards compatible",
				"No new dependencies",
			];

			await repos.artifacts.createScopeCard({
				workflowId,
				title: "Round-trip test",
				description: "Testing JSON fidelity",
				inScope,
				outOfScope,
				constraints,
				recommendedPath: "full",
			});

			const readBack = await repos.artifacts.getLatestScopeCard(workflowId);

			expect(readBack).not.toBeNull();
			expect(readBack?.inScope).toEqual(inScope);
			expect(readBack?.outOfScope).toEqual(outOfScope);
			expect(readBack?.constraints).toEqual(constraints);
		});
	});

	// ===========================================================================
	// ResearchCard Tests
	// ===========================================================================

	describe("ResearchCard", () => {
		test("createResearchCard with all JSON fields returns parsed JSON", async () => {
			const workflowId = await createWorkflow();

			const card = await repos.artifacts.createResearchCard({
				workflowId,
				summary: "Auth system research",
				keyFiles: KEY_FILES,
				patterns: PATTERNS,
				dependencies: DEPENDENCIES,
				integrationPoints: INTEGRATION_POINTS,
				challenges: CHALLENGES,
				recommendations: RECOMMENDATIONS,
			});

			expect(card.id).toMatch(/^research_/);
			expect(card.workflowId).toBe(workflowId);
			expect(card.summary).toBe("Auth system research");
			expect(card.keyFiles).toEqual(KEY_FILES);
			expect(card.patterns).toEqual(PATTERNS);
			expect(card.dependencies).toEqual(DEPENDENCIES);
			expect(card.integrationPoints).toEqual(INTEGRATION_POINTS);
			expect(card.challenges).toEqual(CHALLENGES);
			expect(card.recommendations).toEqual(RECOMMENDATIONS);
			expect(card.status).toBe("pending");
			expect(typeof card.createdAt).toBe("number");
		});

		test("getLatestResearchCard returns the most recently created card", async () => {
			const workflowId = await createWorkflow();

			const first = await repos.artifacts.createResearchCard({
				workflowId,
				summary: "First research",
				keyFiles: [{ path: "a.ts", purpose: "first" }],
				recommendations: ["rec1"],
			});

			// Backdate first record so second has a strictly later created_at
			await db
				.updateTable("research_cards")
				.set({ created_at: first.createdAt - 1000 })
				.where("id", "=", first.id)
				.execute();

			const second = await repos.artifacts.createResearchCard({
				workflowId,
				summary: "Second research",
				keyFiles: [{ path: "b.ts", purpose: "second" }],
				recommendations: ["rec2"],
			});

			const latest = await repos.artifacts.getLatestResearchCard(workflowId);

			expect(latest).not.toBeNull();
			expect(latest?.id).toBe(second.id);
			expect(latest?.summary).toBe("Second research");
		});

		test("getAllResearchCards returns all cards ordered by created_at asc", async () => {
			const workflowId = await createWorkflow();

			const first = await repos.artifacts.createResearchCard({
				workflowId,
				summary: "First",
				keyFiles: [{ path: "a.ts", purpose: "a" }],
				recommendations: ["r1"],
			});

			// Backdate first record to guarantee ordering
			await db
				.updateTable("research_cards")
				.set({ created_at: first.createdAt - 1000 })
				.where("id", "=", first.id)
				.execute();

			const second = await repos.artifacts.createResearchCard({
				workflowId,
				summary: "Second",
				keyFiles: [{ path: "b.ts", purpose: "b" }],
				recommendations: ["r2"],
			});

			const all = await repos.artifacts.getAllResearchCards(workflowId);

			expect(all).toHaveLength(2);
			expect(all[0]?.id).toBe(first.id);
			expect(all[1]?.id).toBe(second.id);
		});

		test("updateResearchCardStatus changes status and persists", async () => {
			const workflowId = await createWorkflow();

			const card = await repos.artifacts.createResearchCard({
				workflowId,
				summary: "Status test",
				keyFiles: [{ path: "x.ts", purpose: "test" }],
				recommendations: ["r"],
			});

			expect(card.status).toBe("pending");

			await repos.artifacts.updateResearchCardStatus(card.id, "approved");

			const latest = await repos.artifacts.getLatestResearchCard(workflowId);
			expect(latest?.status).toBe("approved");
		});

		test("deleteResearchCardsByWorkflow removes all cards for the workflow", async () => {
			const workflowId = await createWorkflow();

			await repos.artifacts.createResearchCard({
				workflowId,
				summary: "Card 1",
				keyFiles: [{ path: "a.ts", purpose: "a" }],
				recommendations: ["r1"],
			});

			await repos.artifacts.createResearchCard({
				workflowId,
				summary: "Card 2",
				keyFiles: [{ path: "b.ts", purpose: "b" }],
				recommendations: ["r2"],
			});

			const before = await repos.artifacts.getAllResearchCards(workflowId);
			expect(before).toHaveLength(2);

			await repos.artifacts.deleteResearchCardsByWorkflow(workflowId);

			const after = await repos.artifacts.getAllResearchCards(workflowId);
			expect(after).toHaveLength(0);
		});

		test("JSON round-trip: all research JSON fields survive create and read back", async () => {
			const workflowId = await createWorkflow();

			const keyFiles = [
				{ path: "src/index.ts", purpose: "Entry point" },
				{
					path: "src/config.ts",
					purpose: "Configuration",
					lineRanges: "10-30",
				},
			];
			const patterns = [
				{
					category: "naming",
					description: "camelCase for variables",
					example: "const myVar = 1",
					locations: ["src/utils.ts"],
				},
			];
			const dependencies = [
				{
					name: "lodash",
					purpose: "Utility functions",
					usageExample: "_.get(obj, 'path')",
				},
			];
			const integrationPoints = [
				{
					location: "src/app.ts",
					description: "App setup",
					existingCode: "app.use(middleware)",
				},
			];
			const challenges = [
				{ issue: "Large dataset", mitigation: "Add pagination" },
			];
			const recommendations = ["Use streaming for large responses"];

			await repos.artifacts.createResearchCard({
				workflowId,
				summary: "Round-trip research",
				keyFiles,
				patterns,
				dependencies,
				integrationPoints,
				challenges,
				recommendations,
			});

			const readBack = await repos.artifacts.getLatestResearchCard(workflowId);

			expect(readBack).not.toBeNull();
			expect(readBack?.keyFiles).toEqual(keyFiles);
			expect(readBack?.patterns).toEqual(patterns);
			expect(readBack?.dependencies).toEqual(dependencies);
			expect(readBack?.integrationPoints).toEqual(integrationPoints);
			expect(readBack?.challenges).toEqual(challenges);
			expect(readBack?.recommendations).toEqual(recommendations);
		});
	});

	// ===========================================================================
	// Plan Tests
	// ===========================================================================

	describe("Plan", () => {
		test("createPlan with pulses_json returns parsed JSON", async () => {
			const workflowId = await createWorkflow();

			const plan = await repos.artifacts.createPlan({
				workflowId,
				approachSummary: "Implement auth in two pulses",
				pulses: PULSES,
			});

			expect(plan.id).toMatch(/^plan_/);
			expect(plan.workflowId).toBe(workflowId);
			expect(plan.approachSummary).toBe("Implement auth in two pulses");
			expect(plan.pulses).toEqual(PULSES);
			expect(Array.isArray(plan.pulses)).toBe(true);
			expect(plan.pulses).toHaveLength(2);
			expect(plan.pulses[0]?.estimatedSize).toBe("medium");
			expect(plan.pulses[1]?.dependsOn).toEqual(["pulse_001"]);
			expect(plan.status).toBe("pending");
			expect(typeof plan.createdAt).toBe("number");
		});

		test("getLatestPlan returns the most recently created plan", async () => {
			const workflowId = await createWorkflow();

			const first = await repos.artifacts.createPlan({
				workflowId,
				approachSummary: "First approach",
				pulses: [PULSE_1],
			});

			// Backdate first record so second has a strictly later created_at
			await db
				.updateTable("plans")
				.set({ created_at: first.createdAt - 1000 })
				.where("id", "=", first.id)
				.execute();

			const second = await repos.artifacts.createPlan({
				workflowId,
				approachSummary: "Second approach",
				pulses: [PULSE_2],
			});

			const latest = await repos.artifacts.getLatestPlan(workflowId);

			expect(latest).not.toBeNull();
			expect(latest?.id).toBe(second.id);
			expect(latest?.approachSummary).toBe("Second approach");
		});

		test("getAllPlans returns all plans ordered by created_at asc", async () => {
			const workflowId = await createWorkflow();

			const first = await repos.artifacts.createPlan({
				workflowId,
				approachSummary: "First",
				pulses: [PULSE_1],
			});

			// Backdate first record to guarantee ordering
			await db
				.updateTable("plans")
				.set({ created_at: first.createdAt - 1000 })
				.where("id", "=", first.id)
				.execute();

			const second = await repos.artifacts.createPlan({
				workflowId,
				approachSummary: "Second",
				pulses: [PULSE_2],
			});

			const all = await repos.artifacts.getAllPlans(workflowId);

			expect(all).toHaveLength(2);
			expect(all[0]?.id).toBe(first.id);
			expect(all[1]?.id).toBe(second.id);
		});

		test("updatePlanStatus changes status and persists", async () => {
			const workflowId = await createWorkflow();

			const plan = await repos.artifacts.createPlan({
				workflowId,
				approachSummary: "Status test",
				pulses: [PULSE_1],
			});

			expect(plan.status).toBe("pending");

			await repos.artifacts.updatePlanStatus(plan.id, "approved");

			const latest = await repos.artifacts.getLatestPlan(workflowId);
			expect(latest?.status).toBe("approved");
		});

		test("deletePlansByWorkflow removes all plans for the workflow", async () => {
			const workflowId = await createWorkflow();

			await repos.artifacts.createPlan({
				workflowId,
				approachSummary: "Plan 1",
				pulses: [PULSE_1],
			});

			await repos.artifacts.createPlan({
				workflowId,
				approachSummary: "Plan 2",
				pulses: [PULSE_2],
			});

			const before = await repos.artifacts.getAllPlans(workflowId);
			expect(before).toHaveLength(2);

			await repos.artifacts.deletePlansByWorkflow(workflowId);

			const after = await repos.artifacts.getAllPlans(workflowId);
			expect(after).toHaveLength(0);
		});

		test("JSON round-trip: pulses_json with PulsesJsonSchema survives create and read back", async () => {
			const workflowId = await createWorkflow();

			const pulses = [
				{
					id: "pulse_rt_001",
					title: "Setup infrastructure",
					description: "Create base config and CI pipeline",
					expectedChanges: ["ci.yml", "tsconfig.json", "package.json"],
					estimatedSize: "large" as const,
				},
				{
					id: "pulse_rt_002",
					title: "Add core module",
					description: "Implement core business logic",
					expectedChanges: ["src/core/index.ts", "src/core/types.ts"],
					estimatedSize: "medium" as const,
					dependsOn: ["pulse_rt_001"],
				},
				{
					id: "pulse_rt_003",
					title: "Add tests",
					description: "Write unit and integration tests",
					expectedChanges: ["tests/core.test.ts"],
					estimatedSize: "small" as const,
					dependsOn: ["pulse_rt_001", "pulse_rt_002"],
				},
			];

			await repos.artifacts.createPlan({
				workflowId,
				approachSummary: "Round-trip test plan",
				pulses,
			});

			const readBack = await repos.artifacts.getLatestPlan(workflowId);

			expect(readBack).not.toBeNull();
			expect(readBack?.pulses).toEqual(pulses);
			expect(readBack?.pulses).toHaveLength(3);
			expect(readBack?.pulses[2]?.dependsOn).toEqual([
				"pulse_rt_001",
				"pulse_rt_002",
			]);
		});
	});

	// ===========================================================================
	// ReviewCard Tests
	// ===========================================================================

	describe("ReviewCard", () => {
		test("createReviewCard maps all fields correctly", async () => {
			const workflowId = await createWorkflow();

			const card = await repos.artifacts.createReviewCard({
				workflowId,
				turnId: "turn_abc",
			});

			expect(card.id).toMatch(/^review_/);
			expect(card.workflowId).toBe(workflowId);
			expect(card.turnId).toBe("turn_abc");
			expect(card.recommendation).toBeUndefined();
			expect(card.summary).toBeUndefined();
			expect(card.suggestedCommitMessage).toBeUndefined();
			expect(card.diffContent).toBeUndefined();
			expect(card.comments).toEqual([]);
			expect(card.status).toBe("pending");
			expect(typeof card.createdAt).toBe("number");
		});

		test("getLatestReviewCard returns the most recently created card", async () => {
			const workflowId = await createWorkflow();

			const first = await repos.artifacts.createReviewCard({ workflowId });

			// Backdate first record so second has a strictly later created_at
			await db
				.updateTable("review_cards")
				.set({ created_at: first.createdAt - 1000 })
				.where("id", "=", first.id)
				.execute();

			const second = await repos.artifacts.createReviewCard({ workflowId });

			const latest = await repos.artifacts.getLatestReviewCard(workflowId);

			expect(latest).not.toBeNull();
			expect(latest?.id).toBe(second.id);
		});

		test("getAllReviewCards returns all cards for a workflow", async () => {
			const workflowId = await createWorkflow();

			const first = await repos.artifacts.createReviewCard({ workflowId });

			// Backdate first record to guarantee ordering
			await db
				.updateTable("review_cards")
				.set({ created_at: first.createdAt - 1000 })
				.where("id", "=", first.id)
				.execute();

			const second = await repos.artifacts.createReviewCard({ workflowId });

			const all = await repos.artifacts.getAllReviewCards(workflowId);

			expect(all).toHaveLength(2);
			expect(all[0]?.id).toBe(first.id);
			expect(all[1]?.id).toBe(second.id);
		});

		test("updateReviewCardStatus changes status and persists", async () => {
			const workflowId = await createWorkflow();

			const card = await repos.artifacts.createReviewCard({ workflowId });

			expect(card.status).toBe("pending");

			await repos.artifacts.updateReviewCardStatus(card.id, "approved");

			const latest = await repos.artifacts.getLatestReviewCard(workflowId);
			expect(latest?.status).toBe("approved");
		});

		test("updateReviewCardDiffContent sets diff content", async () => {
			const workflowId = await createWorkflow();

			const card = await repos.artifacts.createReviewCard({ workflowId });
			expect(card.diffContent).toBeUndefined();

			const diff = "--- a/file.ts\n+++ b/file.ts\n@@ -1 +1 @@\n-old\n+new";
			await repos.artifacts.updateReviewCardDiffContent(card.id, diff);

			const latest = await repos.artifacts.getLatestReviewCard(workflowId);
			expect(latest?.diffContent).toBe(diff);
		});

		test("updateReviewCardCompletion sets recommendation, summary, and commit message", async () => {
			const workflowId = await createWorkflow();

			const card = await repos.artifacts.createReviewCard({ workflowId });

			await repos.artifacts.updateReviewCardCompletion(
				card.id,
				"approve",
				"All changes look good",
				"feat(auth): add login endpoint",
			);

			const latest = await repos.artifacts.getLatestReviewCard(workflowId);
			expect(latest?.recommendation).toBe("approve");
			expect(latest?.summary).toBe("All changes look good");
			expect(latest?.suggestedCommitMessage).toBe(
				"feat(auth): add login endpoint",
			);
		});

		test("setReviewCardTurnId links turn to review cards with null turn_id", async () => {
			const workflowId = await createWorkflow();

			// Create a card without turnId
			const card = await repos.artifacts.createReviewCard({ workflowId });
			expect(card.turnId).toBeUndefined();

			await repos.artifacts.setReviewCardTurnId(workflowId, "turn_xyz");

			const latest = await repos.artifacts.getLatestReviewCard(workflowId);
			expect(latest?.turnId).toBe("turn_xyz");
		});

		test("updateLatestReviewCardTurnId updates the most recent card's turn_id", async () => {
			const workflowId = await createWorkflow();

			const first = await repos.artifacts.createReviewCard({
				workflowId,
				turnId: "turn_first",
			});

			// Backdate first record so second is latest
			await db
				.updateTable("review_cards")
				.set({ created_at: first.createdAt - 1000 })
				.where("id", "=", first.id)
				.execute();

			await repos.artifacts.createReviewCard({
				workflowId,
				turnId: "turn_second",
			});

			await repos.artifacts.updateLatestReviewCardTurnId(
				workflowId,
				"turn_updated",
			);

			const all = await repos.artifacts.getAllReviewCards(workflowId);
			// First card's turn_id should be unchanged
			expect(all[0]?.turnId).toBe("turn_first");
			// Latest card's turn_id should be updated
			expect(all[1]?.turnId).toBe("turn_updated");
		});

		test("resetReviewCard resets status and clears recommendation/summary", async () => {
			const workflowId = await createWorkflow();

			const card = await repos.artifacts.createReviewCard({ workflowId });

			// Complete the review first
			await repos.artifacts.updateReviewCardStatus(card.id, "approved");
			await repos.artifacts.updateReviewCardCompletion(
				card.id,
				"approve",
				"Looks good",
			);

			const before = await repos.artifacts.getLatestReviewCard(workflowId);
			expect(before?.status).toBe("approved");
			expect(before?.recommendation).toBe("approve");
			expect(before?.summary).toBe("Looks good");

			// Reset the review card
			await repos.artifacts.resetReviewCard(card.id);

			const after = await repos.artifacts.getLatestReviewCard(workflowId);
			expect(after?.status).toBe("pending");
			expect(after?.recommendation).toBeUndefined();
			expect(after?.summary).toBeUndefined();
		});
	});

	// ===========================================================================
	// ReviewComment Tests
	// ===========================================================================

	describe("ReviewComment", () => {
		test("createReviewComment creates with all fields mapped correctly", async () => {
			const workflowId = await createWorkflow();
			const card = await repos.artifacts.createReviewCard({ workflowId });

			const comment = await repos.artifacts.createReviewComment({
				reviewCardId: card.id,
				type: "line",
				filePath: "src/auth/login.ts",
				startLine: 10,
				endLine: 15,
				severity: "High",
				category: "security",
				description: "Password not hashed before storage",
				author: "agent",
			});

			expect(comment.id).toMatch(/^comment_/);
			expect(comment.reviewCardId).toBe(card.id);
			expect(comment.type).toBe("line");
			expect(comment.filePath).toBe("src/auth/login.ts");
			expect(comment.startLine).toBe(10);
			expect(comment.endLine).toBe(15);
			expect(comment.severity).toBe("High");
			expect(comment.category).toBe("security");
			expect(comment.description).toBe("Password not hashed before storage");
			expect(comment.author).toBe("agent");
			expect(typeof comment.createdAt).toBe("number");
		});

		test("getCommentsByReviewCard returns all comments for a card", async () => {
			const workflowId = await createWorkflow();
			const card = await repos.artifacts.createReviewCard({ workflowId });

			await repos.artifacts.createReviewComment({
				reviewCardId: card.id,
				type: "line",
				filePath: "src/a.ts",
				startLine: 1,
				severity: "Medium",
				description: "First comment",
			});

			await repos.artifacts.createReviewComment({
				reviewCardId: card.id,
				type: "review",
				description: "Second comment",
			});

			const comments = await repos.artifacts.getCommentsByReviewCard(card.id);

			expect(comments).toHaveLength(2);
			expect(comments[0]?.description).toBe("First comment");
			expect(comments[1]?.description).toBe("Second comment");
		});

		test("getCommentsByIds returns only the requested comments", async () => {
			const workflowId = await createWorkflow();
			const card = await repos.artifacts.createReviewCard({ workflowId });

			const c1 = await repos.artifacts.createReviewComment({
				reviewCardId: card.id,
				type: "review",
				description: "Comment 1",
			});

			const c2 = await repos.artifacts.createReviewComment({
				reviewCardId: card.id,
				type: "file",
				filePath: "src/b.ts",
				description: "Comment 2",
			});

			const c3 = await repos.artifacts.createReviewComment({
				reviewCardId: card.id,
				type: "line",
				filePath: "src/c.ts",
				startLine: 5,
				description: "Comment 3",
			});

			const result = await repos.artifacts.getCommentsByIds([c1.id, c3.id]);

			expect(result).toHaveLength(2);
			const resultIds = result.map((c) => c.id);
			expect(resultIds).toContain(c1.id);
			expect(resultIds).toContain(c3.id);
			// c2 should not be included
			expect(resultIds).not.toContain(c2.id);
		});

		test("deleteReviewComments removes all comments for a review card", async () => {
			const workflowId = await createWorkflow();
			const card = await repos.artifacts.createReviewCard({ workflowId });

			await repos.artifacts.createReviewComment({
				reviewCardId: card.id,
				type: "review",
				description: "Will be deleted 1",
			});

			await repos.artifacts.createReviewComment({
				reviewCardId: card.id,
				type: "review",
				description: "Will be deleted 2",
			});

			const before = await repos.artifacts.getCommentsByReviewCard(card.id);
			expect(before).toHaveLength(2);

			await repos.artifacts.deleteReviewComments(card.id);

			const after = await repos.artifacts.getCommentsByReviewCard(card.id);
			expect(after).toHaveLength(0);
		});
	});

	// ===========================================================================
	// Cascade Delete Tests
	// ===========================================================================

	describe("deleteReviewCardsByWorkflow (cascade)", () => {
		test("deletes review cards and their comments for a workflow", async () => {
			const workflowId = await createWorkflow();

			const card = await repos.artifacts.createReviewCard({ workflowId });

			await repos.artifacts.createReviewComment({
				reviewCardId: card.id,
				type: "review",
				description: "Cascade comment 1",
			});

			await repos.artifacts.createReviewComment({
				reviewCardId: card.id,
				type: "line",
				filePath: "src/x.ts",
				startLine: 1,
				description: "Cascade comment 2",
			});

			// Verify card and comments exist
			const cardsBefore = await repos.artifacts.getAllReviewCards(workflowId);
			expect(cardsBefore).toHaveLength(1);
			expect(cardsBefore[0]?.comments).toHaveLength(2);

			// Delete by workflow — should cascade to comments
			await repos.artifacts.deleteReviewCardsByWorkflow(workflowId);

			// Verify card is removed
			const cardsAfter = await repos.artifacts.getAllReviewCards(workflowId);
			expect(cardsAfter).toHaveLength(0);

			// Verify comments are also removed (query directly)
			const orphanedComments = await repos.artifacts.getCommentsByReviewCard(
				card.id,
			);
			expect(orphanedComments).toHaveLength(0);
		});
	});

	// ===========================================================================
	// getPendingArtifact Tests
	// ===========================================================================

	describe("getPendingArtifact", () => {
		test("returns pending scope card for scope_card type", async () => {
			const workflowId = await createWorkflow();

			const scopeCard = await repos.artifacts.createScopeCard({
				workflowId,
				title: "Pending scope",
				description: "A pending scope card",
				inScope: ["item"],
				outOfScope: ["other"],
				recommendedPath: "quick",
			});

			const result = await repos.artifacts.getPendingArtifact(
				workflowId,
				"scope_card",
			);

			expect(result).not.toBeNull();
			expect(result?.id).toBe(scopeCard.id);
			expect(result?.status).toBe("pending");
		});

		test("returns pending research card for research type", async () => {
			const workflowId = await createWorkflow();

			const card = await repos.artifacts.createResearchCard({
				workflowId,
				summary: "Pending research",
				keyFiles: [{ path: "src/a.ts", purpose: "test" }],
				recommendations: ["rec"],
			});

			const result = await repos.artifacts.getPendingArtifact(
				workflowId,
				"research",
			);

			expect(result).not.toBeNull();
			expect(result?.id).toBe(card.id);
			expect(result?.status).toBe("pending");
		});

		test("returns pending plan for plan type", async () => {
			const workflowId = await createWorkflow();

			const plan = await repos.artifacts.createPlan({
				workflowId,
				approachSummary: "Pending plan",
				pulses: [PULSE_1],
			});

			const result = await repos.artifacts.getPendingArtifact(
				workflowId,
				"plan",
			);

			expect(result).not.toBeNull();
			expect(result?.id).toBe(plan.id);
			expect(result?.status).toBe("pending");
		});

		test("returns pending review card for review_card type", async () => {
			const workflowId = await createWorkflow();

			const card = await repos.artifacts.createReviewCard({ workflowId });

			const result = await repos.artifacts.getPendingArtifact(
				workflowId,
				"review_card",
			);

			expect(result).not.toBeNull();
			expect(result?.id).toBe(card.id);
			expect(result?.status).toBe("pending");
		});

		test("returns null when artifactType is null", async () => {
			const workflowId = await createWorkflow();

			const result = await repos.artifacts.getPendingArtifact(workflowId, null);

			expect(result).toBeNull();
		});

		test("returns null when artifactType is undefined", async () => {
			const workflowId = await createWorkflow();

			const result = await repos.artifacts.getPendingArtifact(
				workflowId,
				undefined,
			);

			expect(result).toBeNull();
		});

		test("returns null when no artifact exists for the workflow", async () => {
			const workflowId = await createWorkflow();

			const result = await repos.artifacts.getPendingArtifact(
				workflowId,
				"scope_card",
			);

			expect(result).toBeNull();
		});
	});
});
