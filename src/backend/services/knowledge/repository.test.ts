/**
 * Tests for KnowledgeRepository injection event APIs
 *
 * Covers bulk insert and bidirectional lookups:
 * - listKnowledgeInjectionEventsByKnowledgeItemId (ordered by createdAt desc)
 * - listInjectedKnowledgeItemsForTurnKey (composite key lookup)
 */

import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import type { Kysely } from "kysely";
import { Kysely as KyselyCtor } from "kysely";
import { BunSqliteDialect } from "kysely-bun-sqlite";
import { migrateKnowledgeDb } from "@/backend/db/knowledge/migrations";
import type { KnowledgeDatabase } from "@/backend/db/knowledge/types";
import { ids } from "@/backend/utils/ids";
import { KnowledgeRepository } from "./repository";

async function createRepo(): Promise<{
	db: Kysely<KnowledgeDatabase>;
	repo: KnowledgeRepository;
	destroy: () => Promise<void>;
}> {
	const database = new Database(":memory:");
	const db = new KyselyCtor<KnowledgeDatabase>({
		dialect: new BunSqliteDialect({ database }),
	});
	await migrateKnowledgeDb(db);
	const repo = new KnowledgeRepository(db);
	return {
		db,
		repo,
		destroy: async () => {
			await db.destroy();
		},
	};
}

async function createKnowledgeItem(
	db: Kysely<KnowledgeDatabase>,
	params?: {
		workflowId?: string;
		createdAt?: number;
	},
): Promise<string> {
	const id = ids.knowledge();
	await db
		.insertInto("knowledge_items")
		.values({
			id,
			workflow_id: params?.workflowId ?? "wf_1",
			card_id: null,
			session_id: null,
			turn_id: null,
			title: "Title",
			content: "Content",
			category: "pattern",
			tags_json: "[]",
			created_at: params?.createdAt ?? Date.now(),
			archived: 0,
		})
		.execute();

	return id;
}

describe("KnowledgeRepository injection events", () => {
	test("insertKnowledgeInjectionEvents inserts rows and listKnowledgeInjectionEventsByKnowledgeItemId returns createdAt desc", async () => {
		const { db, repo, destroy } = await createRepo();
		try {
			const itemId = await createKnowledgeItem(db);

			await repo.insertKnowledgeInjectionEvents({
				sessionId: "sess_1",
				turnId: "turn_1",
				agentRole: "scoping",
				workflowId: "wf_1",
				workflowStage: "stage_a",
				queryText: "how to do x",
				tokenBudget: 1234,
				truncated: false,
				items: [{ knowledgeItemId: itemId, similarity: 0.91 }],
			});

			await repo.insertKnowledgeInjectionEvents({
				sessionId: "sess_1",
				turnId: "turn_2",
				agentRole: "scoping",
				workflowId: "wf_1",
				workflowStage: "stage_a",
				queryText: "how to do y",
				tokenBudget: 1234,
				truncated: true,
				items: [{ knowledgeItemId: itemId, similarity: 0.77 }],
			});

			const events =
				await repo.listKnowledgeInjectionEventsByKnowledgeItemId(itemId);
			expect(events).toHaveLength(2);

			const latest = events[0];
			const earliest = events[1];
			expect(latest).toBeDefined();
			expect(earliest).toBeDefined();
			if (!latest || !earliest) {
				throw new Error("Expected two injection events");
			}

			expect(latest.createdAt).toBeGreaterThanOrEqual(earliest.createdAt);
			expect(latest.knowledgeItemId).toBe(itemId);

			const queryTexts = events.map((e) => e.queryText).sort();
			expect(queryTexts).toEqual(["how to do x", "how to do y"].sort());

			// Privacy-safe: ensure no knowledge item content fields are exposed.
			expect(Object.keys(latest)).not.toContain("content");
			expect(Object.keys(latest)).not.toContain("title");
		} finally {
			await destroy();
		}
	});

	test("listInjectedKnowledgeItemsForTurnKey returns injected items for composite key", async () => {
		const { db, repo, destroy } = await createRepo();
		try {
			const itemIdA = await createKnowledgeItem(db);
			const itemIdB = await createKnowledgeItem(db);

			await repo.insertKnowledgeInjectionEvents({
				sessionId: "sess_2",
				turnId: "turn_3",
				agentRole: "execution",
				workflowId: "wf_2",
				workflowStage: "stage_b",
				queryText: "q",
				tokenBudget: 500,
				truncated: false,
				items: [
					{ knowledgeItemId: itemIdA, similarity: 0.8 },
					{ knowledgeItemId: itemIdB, similarity: 0.6 },
				],
			});

			// Different key should not be returned
			await repo.insertKnowledgeInjectionEvents({
				sessionId: "sess_2",
				turnId: "turn_4",
				agentRole: "execution",
				workflowId: "wf_2",
				workflowStage: "stage_b",
				queryText: "q2",
				tokenBudget: 500,
				truncated: false,
				items: [{ knowledgeItemId: itemIdA, similarity: 0.99 }],
			});

			const injected = await repo.listInjectedKnowledgeItemsForTurnKey({
				workflowId: "wf_2",
				sessionId: "sess_2",
				turnId: "turn_3",
				agentRole: "execution",
				workflowStage: "stage_b",
			});

			expect(injected).toHaveLength(2);
			const idsReturned = injected.map((it) => it.knowledgeItemId).sort();
			expect(idsReturned).toEqual([itemIdA, itemIdB].sort());
		} finally {
			await destroy();
		}
	});
});
