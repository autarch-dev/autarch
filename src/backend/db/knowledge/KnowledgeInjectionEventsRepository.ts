import type { Kysely, Selectable } from "kysely";

import type {
	InsertableKnowledgeInjectionEvent,
	KnowledgeDatabase,
	KnowledgeInjectionEventsTable,
} from "./types";

export type KnowledgeInjectionEvent = Selectable<KnowledgeInjectionEventsTable>;

export interface KnowledgeInjectionEventTurnKey {
	workflow_id: string | null;
	session_id: string | null;
	turn_id: string | null;
	agent_role: string | null;
	workflow_stage: string | null;
}

export class KnowledgeInjectionEventsRepository {
	constructor(private readonly db: Kysely<KnowledgeDatabase>) {}

	async insert(event: InsertableKnowledgeInjectionEvent): Promise<void> {
		await this.db
			.insertInto("knowledge_injection_events")
			.values(event)
			.execute();
	}

	/**
	 * Query by per-turn attribution keys.
	 *
	 * Nullable semantics:
	 * - If a filter value is null, we match rows where the column IS NULL.
	 * - If a filter value is undefined, we do not filter by that column.
	 */
	async listByTurnKey(
		turnKey: Partial<{
			workflow_id: string | null;
			session_id: string | null;
			turn_id: string | null;
			agent_role: string | null;
			workflow_stage: string | null;
		}>,
	): Promise<KnowledgeInjectionEvent[]> {
		let query = this.db
			.selectFrom("knowledge_injection_events")
			.selectAll()
			.orderBy("created_at", "desc");

		if (turnKey.workflow_id === null)
			query = query.where("workflow_id", "is", null);
		else if (turnKey.workflow_id !== undefined)
			query = query.where("workflow_id", "=", turnKey.workflow_id);

		if (turnKey.session_id === null)
			query = query.where("session_id", "is", null);
		else if (turnKey.session_id !== undefined)
			query = query.where("session_id", "=", turnKey.session_id);

		if (turnKey.turn_id === null) query = query.where("turn_id", "is", null);
		else if (turnKey.turn_id !== undefined)
			query = query.where("turn_id", "=", turnKey.turn_id);

		if (turnKey.agent_role === null)
			query = query.where("agent_role", "is", null);
		else if (turnKey.agent_role !== undefined)
			query = query.where("agent_role", "=", turnKey.agent_role);

		if (turnKey.workflow_stage === null)
			query = query.where("workflow_stage", "is", null);
		else if (turnKey.workflow_stage !== undefined)
			query = query.where("workflow_stage", "=", turnKey.workflow_stage);

		return await query.execute();
	}

	async listByKnowledgeItemId(
		knowledgeItemId: string,
	): Promise<KnowledgeInjectionEvent[]> {
		return await this.db
			.selectFrom("knowledge_injection_events")
			.selectAll()
			.where("knowledge_item_id", "=", knowledgeItemId)
			.orderBy("created_at", "desc")
			.execute();
	}
}
