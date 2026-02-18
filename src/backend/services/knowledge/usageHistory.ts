/**
 * Knowledge Usage History Service
 *
 * Internal helper functions to query privacy-safe knowledge injection usage history.
 * These helpers acquire the knowledge DB connection internally so callers don't
 * need to manage DB setup.
 */

import { getKnowledgeDb } from "@/backend/db/knowledge";
import type { KnowledgeInjectionEvent } from "@/backend/services/knowledge/repository";
import { KnowledgeRepository } from "@/backend/services/knowledge/repository";

export async function getUsageByKnowledgeItem(
	projectRoot: string,
	knowledgeItemId: string,
): Promise<KnowledgeInjectionEvent[]> {
	const knowledgeDb = await getKnowledgeDb(projectRoot);
	const knowledgeRepo = new KnowledgeRepository(knowledgeDb);

	return knowledgeRepo.listKnowledgeInjectionEventsByKnowledgeItemId(
		knowledgeItemId,
	);
}

export async function getInjectedItemsForTurn(
	projectRoot: string,
	turnKey: {
		workflowId: string;
		sessionId: string;
		turnId: string;
		agentRole: string;
		workflowStage: string;
	},
): Promise<Array<{ knowledgeItemId: string; similarity: number }>> {
	const knowledgeDb = await getKnowledgeDb(projectRoot);
	const knowledgeRepo = new KnowledgeRepository(knowledgeDb);

	return knowledgeRepo.listInjectedKnowledgeItemsForTurnKey(turnKey);
}
