/**
 * CostRecordRepository - Data access for immutable cost records
 *
 * Provides insert and aggregation methods for append-only cost tracking.
 * Cost records are never deleted, even when sessions/turns are removed
 * during workflow rewind operations.
 */

import type { SessionContextType } from "@/shared/schemas/session";

import type { ProjectDb, Repository } from "./types";

// =============================================================================
// Types
// =============================================================================

export interface InsertCostRecordData {
	id: string;
	contextType: SessionContextType;
	contextId: string;
	turnId: string;
	sessionId: string;
	modelId: string;
	agentRole: string;
	promptTokens: number;
	completionTokens: number;
	costUsd: number;
	createdAt: number;
}

// =============================================================================
// Repository
// =============================================================================

export class CostRecordRepository implements Repository {
	constructor(readonly db: ProjectDb) {}

	/**
	 * Insert a single cost record.
	 */
	async insert(record: InsertCostRecordData): Promise<void> {
		await this.db
			.insertInto("cost_records")
			.values({
				id: record.id,
				context_type: record.contextType,
				context_id: record.contextId,
				turn_id: record.turnId,
				session_id: record.sessionId,
				model_id: record.modelId,
				agent_role: record.agentRole,
				prompt_tokens: record.promptTokens,
				completion_tokens: record.completionTokens,
				cost_usd: record.costUsd,
				created_at: record.createdAt,
			})
			.execute();
	}

	/**
	 * Sum cost_usd for all records matching a context type and ID.
	 * Returns 0 if no records match.
	 */
	async sumByContext(
		contextType: SessionContextType,
		contextId: string,
	): Promise<number> {
		const result = await this.db
			.selectFrom("cost_records")
			.select((eb) => eb.fn.sum<number>("cost_usd").as("total"))
			.where("context_type", "=", contextType)
			.where("context_id", "=", contextId)
			.executeTakeFirst();

		return result?.total ?? 0;
	}

	/**
	 * Sum cost_usd for all records matching a context type and multiple IDs.
	 * Returns 0 if contextIds is empty or no records match.
	 */
	async sumByContextIds(
		contextType: SessionContextType,
		contextIds: string[],
	): Promise<number> {
		if (contextIds.length === 0) {
			return 0;
		}

		const result = await this.db
			.selectFrom("cost_records")
			.select((eb) => eb.fn.sum<number>("cost_usd").as("total"))
			.where("context_type", "=", contextType)
			.where("context_id", "in", contextIds)
			.executeTakeFirst();

		return result?.total ?? 0;
	}

	/**
	 * Compute total cost for a workflow including its subtasks.
	 * Queries cost_records where (context_type='workflow' AND context_id=workflowId)
	 * OR (context_type='subtask' AND context_id IN subtaskIds).
	 * Returns 0 if no records match.
	 */
	async getTotalWorkflowCost(
		workflowId: string,
		subtaskIds: string[],
	): Promise<number> {
		let query = this.db
			.selectFrom("cost_records")
			.select((eb) => eb.fn.sum<number>("cost_usd").as("total"));

		if (subtaskIds.length === 0) {
			query = query
				.where("context_type", "=", "workflow")
				.where("context_id", "=", workflowId);
		} else {
			query = query.where((eb) =>
				eb.or([
					eb.and([
						eb("context_type", "=", "workflow"),
						eb("context_id", "=", workflowId),
					]),
					eb.and([
						eb("context_type", "=", "subtask"),
						eb("context_id", "in", subtaskIds),
					]),
				]),
			);
		}

		const result = await query.executeTakeFirst();

		return result?.total ?? 0;
	}
}
