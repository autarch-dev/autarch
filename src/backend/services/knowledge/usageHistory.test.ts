import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { Kysely } from "kysely";

import { getKnowledgeDb } from "@/backend/db/knowledge";
import type { KnowledgeDatabase } from "@/backend/db/knowledge/types";
import { KnowledgeRepository } from "@/backend/services/knowledge/repository";
import {
	getInjectedItemsForTurn,
	getUsageByKnowledgeItem,
} from "@/backend/services/knowledge/usageHistory";
import { ids } from "@/backend/utils/ids";

async function createDb(
	projectRoot: string,
	dbPath: string,
): Promise<{
	db: Kysely<KnowledgeDatabase>;
	destroy: () => Promise<void>;
}> {
	const parentDir = dirname(dbPath);
	await mkdir(parentDir, { recursive: true });

	// Create the sqlite file on disk, but use getKnowledgeDb(projectRoot) for all reads/writes
	// so service helpers and test setup share the same connection semantics.
	const database = new Database(dbPath);
	const db = await getKnowledgeDb(projectRoot);
	return {
		db,
		destroy: async () => {
			await db.destroy();
			database.close();
			try {
				await Bun.file(dbPath).delete();
			} catch {
				// ignore
			}
		},
	};
}

async function createKnowledgeItem(
	db: Kysely<KnowledgeDatabase>,
): Promise<string> {
	const id = ids.knowledge();
	await db
		.insertInto("knowledge_items")
		.values({
			id,
			workflow_id: "wf_1",
			card_id: null,
			session_id: null,
			turn_id: null,
			title: "Title",
			content: "Content",
			category: "pattern",
			tags_json: "[]",
			created_at: Date.now(),
			archived: 0,
		})
		.execute();
	return id;
}

describe("knowledge usageHistory service", () => {
	test("getUsageByKnowledgeItem returns repository data", async () => {
		const projectRoot = `/tmp/knowledge-usageHistory-${Date.now()}-${Math.random()}`;
		await mkdir(projectRoot, { recursive: true });
		const dbPath = `${projectRoot}/.autarch/knowledge.sqlite`;
		const { db, destroy } = await createDb(projectRoot, dbPath);
		try {
			const repo = new KnowledgeRepository(db);
			const itemId = await createKnowledgeItem(db);

			await repo.insertKnowledgeInjectionEvents({
				sessionId: "sess",
				turnId: "turn",
				agentRole: "agent",
				workflowId: "wf",
				workflowStage: "stage",
				queryText: "query",
				tokenBudget: 123,
				truncated: false,
				items: [{ knowledgeItemId: itemId, similarity: 0.42 }],
			});

			const events = await getUsageByKnowledgeItem(projectRoot, itemId);
			expect(events).toHaveLength(1);

			const event = events[0];
			expect(event).toBeDefined();
			if (!event) {
				throw new Error("Expected one injection event");
			}

			expect(event.knowledgeItemId).toBe(itemId);
			expect(event.similarity).toBeCloseTo(0.42);

			// Privacy-safe: ensure no knowledge item content fields are exposed.
			expect(Object.keys(event)).not.toContain("content");
			expect(Object.keys(event)).not.toContain("title");
		} finally {
			await destroy();
		}
	});

	test("getInjectedItemsForTurn returns injected items for composite turn key (privacy-safe)", async () => {
		const projectRoot = `/tmp/knowledge-usageHistory-${Date.now()}-${Math.random()}`;
		await mkdir(projectRoot, { recursive: true });
		const dbPath = `${projectRoot}/.autarch/knowledge.sqlite`;
		const { db, destroy } = await createDb(projectRoot, dbPath);
		try {
			const repo = new KnowledgeRepository(db);
			const itemId1 = await createKnowledgeItem(db);
			const itemId2 = await createKnowledgeItem(db);

			await repo.insertKnowledgeInjectionEvents({
				workflowId: "wf2",
				sessionId: "sess2",
				turnId: "turn2",
				agentRole: "agent2",
				workflowStage: "stage2",
				queryText: "query2",
				tokenBudget: 50,
				truncated: true,
				items: [
					{ knowledgeItemId: itemId1, similarity: 0.9 },
					{ knowledgeItemId: itemId2, similarity: 0.8 },
				],
			});

			const injected = await getInjectedItemsForTurn(projectRoot, {
				workflowId: "wf2",
				sessionId: "sess2",
				turnId: "turn2",
				agentRole: "agent2",
				workflowStage: "stage2",
			});

			expect(injected).toEqual(
				expect.arrayContaining([
					{ knowledgeItemId: itemId1, similarity: 0.9 },
					{ knowledgeItemId: itemId2, similarity: 0.8 },
				]),
			);

			for (const row of injected) {
				expect(Object.keys(row).sort()).toEqual(
					["knowledgeItemId", "similarity"].sort(),
				);
			}
		} finally {
			await destroy();
		}
	});
});
