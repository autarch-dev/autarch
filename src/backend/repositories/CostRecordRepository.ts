/**
 * CostRecordRepository - Data access for immutable cost records
 *
 * Provides insert and aggregation methods for append-only cost tracking.
 * Cost records are never deleted, even when sessions/turns are removed
 * during workflow rewind operations.
 */

import { sql } from "kysely";

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

export interface CostRecordFilters {
	startDate?: string;
	endDate?: string;
	modelId?: string;
	workflowId?: string;
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

	// =========================================================================
	// Aggregation Methods (with optional filters)
	// =========================================================================

	/**
	 * Apply optional filters to a cost_records query.
	 * Conditionally chains WHERE clauses for date range, model, and workflow.
	 */
	// biome-ignore lint/suspicious/noExplicitAny: Kysely query builders have complex generic signatures
	private applyFilters<T extends { where(...args: any[]): T }>(
		query: T,
		filters?: CostRecordFilters,
	): T {
		if (!filters) return query;

		let q = query;

		if (filters.startDate) {
			const startEpoch = Math.floor(
				new Date(filters.startDate).getTime() / 1000,
			);
			if (Number.isNaN(startEpoch)) {
				throw new Error(`Invalid startDate: ${filters.startDate}`);
			}
			q = q.where("created_at", ">=", startEpoch);
		}

		if (filters.endDate) {
			const endEpoch = Math.floor(new Date(filters.endDate).getTime() / 1000);
			if (Number.isNaN(endEpoch)) {
				throw new Error(`Invalid endDate: ${filters.endDate}`);
			}
			q = q.where("created_at", "<=", endEpoch);
		}

		if (filters.modelId) {
			q = q.where("model_id", "=", filters.modelId);
		}

		if (filters.workflowId) {
			q = q.where("context_type", "=", "workflow");
			q = q.where("context_id", "=", filters.workflowId);
		}

		return q;
	}

	/**
	 * Get summary totals across all cost records, optionally filtered.
	 * Returns total cost, token counts, and record count.
	 */
	async getSummary(filters?: CostRecordFilters): Promise<{
		totalCost: number;
		promptTokens: number;
		completionTokens: number;
		count: number;
	}> {
		let query = this.db
			.selectFrom("cost_records")
			.select((eb) => [
				eb.fn.sum<number>("cost_usd").as("total_cost"),
				eb.fn.sum<number>("prompt_tokens").as("prompt_tokens"),
				eb.fn.sum<number>("completion_tokens").as("completion_tokens"),
				eb.fn.count<number>("id").as("count"),
			]);

		query = this.applyFilters(query, filters);

		const result = await query.executeTakeFirst();

		return {
			totalCost: result?.total_cost ?? 0,
			promptTokens: result?.prompt_tokens ?? 0,
			completionTokens: result?.completion_tokens ?? 0,
			count: result?.count ?? 0,
		};
	}

	/**
	 * Get cost breakdown grouped by model.
	 * Returns per-model totals for cost and tokens.
	 */
	async getByModel(filters?: CostRecordFilters): Promise<
		Array<{
			modelId: string;
			totalCost: number;
			promptTokens: number;
			completionTokens: number;
		}>
	> {
		let query = this.db
			.selectFrom("cost_records")
			.select((eb) => [
				"model_id",
				eb.fn.sum<number>("cost_usd").as("total_cost"),
				eb.fn.sum<number>("prompt_tokens").as("prompt_tokens"),
				eb.fn.sum<number>("completion_tokens").as("completion_tokens"),
			])
			.groupBy("model_id");

		query = this.applyFilters(query, filters);

		const rows = await query.execute();

		return rows.map((row) => ({
			modelId: row.model_id,
			totalCost: row.total_cost ?? 0,
			promptTokens: row.prompt_tokens ?? 0,
			completionTokens: row.completion_tokens ?? 0,
		}));
	}

	/**
	 * Get cost breakdown grouped by agent role.
	 * Returns per-role totals for cost and tokens.
	 */
	async getByRole(filters?: CostRecordFilters): Promise<
		Array<{
			agentRole: string;
			totalCost: number;
			promptTokens: number;
			completionTokens: number;
		}>
	> {
		let query = this.db
			.selectFrom("cost_records")
			.select((eb) => [
				"agent_role",
				eb.fn.sum<number>("cost_usd").as("total_cost"),
				eb.fn.sum<number>("prompt_tokens").as("prompt_tokens"),
				eb.fn.sum<number>("completion_tokens").as("completion_tokens"),
			])
			.groupBy("agent_role");

		query = this.applyFilters(query, filters);

		const rows = await query.execute();

		return rows.map((row) => ({
			agentRole: row.agent_role,
			totalCost: row.total_cost ?? 0,
			promptTokens: row.prompt_tokens ?? 0,
			completionTokens: row.completion_tokens ?? 0,
		}));
	}

	/**
	 * Get cost trends over time grouped by date or week.
	 * Returns time-series data for charting.
	 */
	async getTrends(
		filters?: CostRecordFilters,
		granularity: "daily" | "weekly" = "daily",
	): Promise<
		Array<{
			date: string;
			totalCost: number;
			count: number;
		}>
	> {
		const dateExpr =
			granularity === "weekly"
				? sql<string>`strftime('%Y-%W', ${sql.ref("created_at")}, 'unixepoch')`
				: sql<string>`date(${sql.ref("created_at")}, 'unixepoch')`;

		let query = this.db
			.selectFrom("cost_records")
			.where("created_at", "is not", null)
			.where("created_at", ">", 0)
			.select((eb) => [
				dateExpr.as("date"),
				eb.fn.sum<number>("cost_usd").as("total_cost"),
				eb.fn.count<number>("id").as("count"),
			])
			.groupBy(dateExpr)
			.orderBy(dateExpr, "asc");

		query = this.applyFilters(query, filters);

		const rows = await query.execute();

		return rows.map((row) => ({
			date: row.date,
			totalCost: row.total_cost ?? 0,
			count: row.count ?? 0,
		}));
	}

	/**
	 * Get token usage breakdown grouped by model.
	 * Returns per-model prompt and completion token totals.
	 */
	async getTokenUsage(filters?: CostRecordFilters): Promise<
		Array<{
			modelId: string;
			promptTokens: number;
			completionTokens: number;
		}>
	> {
		let query = this.db
			.selectFrom("cost_records")
			.select((eb) => [
				"model_id",
				eb.fn.sum<number>("prompt_tokens").as("prompt_tokens"),
				eb.fn.sum<number>("completion_tokens").as("completion_tokens"),
			])
			.groupBy("model_id");

		query = this.applyFilters(query, filters);

		const rows = await query.execute();

		return rows.map((row) => ({
			modelId: row.model_id,
			promptTokens: row.prompt_tokens ?? 0,
			completionTokens: row.completion_tokens ?? 0,
		}));
	}

	/**
	 * Get cost breakdown grouped by workflow.
	 * Only includes records where context_type='workflow'.
	 * Returns per-workflow totals for cost, tokens, and record count.
	 * Workflow titles should be enriched by the route handler.
	 */
	async getByWorkflow(filters?: CostRecordFilters): Promise<
		Array<{
			workflowId: string;
			totalCost: number;
			promptTokens: number;
			completionTokens: number;
			count: number;
		}>
	> {
		let query = this.db
			.selectFrom("cost_records")
			.select((eb) => [
				"context_id",
				eb.fn.sum<number>("cost_usd").as("total_cost"),
				eb.fn.sum<number>("prompt_tokens").as("prompt_tokens"),
				eb.fn.sum<number>("completion_tokens").as("completion_tokens"),
				eb.fn.count<number>("id").as("count"),
			])
			.where("context_type", "=", "workflow")
			.groupBy("context_id");

		query = this.applyFilters(query, filters);

		const rows = await query.execute();

		return rows.map((row) => ({
			workflowId: row.context_id,
			totalCost: row.total_cost ?? 0,
			promptTokens: row.prompt_tokens ?? 0,
			completionTokens: row.completion_tokens ?? 0,
			count: row.count ?? 0,
		}));
	}
}
