/**
 * AnalyticsRepository - Data access for immutable analytics records
 *
 * Provides insert and aggregation methods for append-only stage transitions
 * and workflow error tracking. Records are never deleted, even when workflows
 * are removed or archived.
 */

import { sql } from "kysely";

import { ids } from "@/backend/utils";

import type { AnalyticsFilters } from "@/shared/schemas/analytics";

import type { ProjectDb, Repository } from "./types";

// =============================================================================
// Types
// =============================================================================

export interface InsertStageTransitionData {
	workflowId: string;
	previousStage: string;
	newStage: string;
	transitionType?: string;
}

export interface InsertWorkflowErrorData {
	workflowId: string;
	stage: string;
	errorType?: string;
	errorMessage: string;
}

export class AnalyticsValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "AnalyticsValidationError";
	}
}

// =============================================================================
// Repository
// =============================================================================

export class AnalyticsRepository implements Repository {
	constructor(readonly db: ProjectDb) {}

	// =========================================================================
	// Insert Methods (append-only, no updates)
	// =========================================================================

	/**
	 * Insert a stage transition record.
	 */
	async insertStageTransition(data: InsertStageTransitionData): Promise<void> {
		await this.db
			.insertInto("stage_transitions")
			.values({
				id: ids.stageTransition(),
				workflow_id: data.workflowId,
				previous_stage: data.previousStage,
				new_stage: data.newStage,
				timestamp: Math.floor(Date.now() / 1000),
				transition_type: data.transitionType ?? "advance",
			})
			.execute();
	}

	/**
	 * Insert a workflow error record.
	 */
	async insertWorkflowError(data: InsertWorkflowErrorData): Promise<void> {
		await this.db
			.insertInto("workflow_errors")
			.values({
				id: ids.workflowError(),
				workflow_id: data.workflowId,
				stage: data.stage,
				error_type: data.errorType ?? "workflow_error",
				error_message: data.errorMessage,
				timestamp: Math.floor(Date.now() / 1000),
			})
			.execute();
	}

	// =========================================================================
	// Aggregation Methods (with optional filters)
	// =========================================================================

	/**
	 * Apply optional filters to a query.
	 * Conditionally chains WHERE clauses for date range.
	 */
	// biome-ignore lint/suspicious/noExplicitAny: Kysely query builders have complex generic signatures
	private applyFilters<T extends { where(...args: any[]): T }>(
		query: T,
		filters?: AnalyticsFilters,
		timestampColumn = "timestamp",
		{ useMilliseconds = false }: { useMilliseconds?: boolean } = {},
	): T {
		if (!filters) return query;

		let q = query;

		if (filters.startDate) {
			const startMs = new Date(filters.startDate).getTime();
			if (Number.isNaN(startMs)) {
				throw new AnalyticsValidationError(
					`Invalid startDate: ${filters.startDate}`,
				);
			}
			const startEpoch = useMilliseconds ? startMs : Math.floor(startMs / 1000);
			q = q.where(timestampColumn, ">=", startEpoch);
		}

		if (filters.endDate) {
			const endMs = new Date(filters.endDate).getTime();
			if (Number.isNaN(endMs)) {
				throw new AnalyticsValidationError(
					`Invalid endDate: ${filters.endDate}`,
				);
			}
			const endEpoch = useMilliseconds ? endMs : Math.floor(endMs / 1000);
			q = q.where(timestampColumn, "<=", endEpoch);
		}

		return q;
	}

	/**
	 * Get success/failure rates across workflows.
	 * Counts workflows grouped by status, optionally filtered by created_at date range.
	 */
	async getSuccessFailureRates(
		filters?: AnalyticsFilters,
	): Promise<Array<{ status: string; count: number }>> {
		let query = this.db
			.selectFrom("workflows")
			.select((eb) => ["status", eb.fn.count<number>("id").as("count")])
			.groupBy("status");

		query = this.applyFilters(query, filters, "created_at", {
			useMilliseconds: true,
		});

		const rows = await query.execute();

		return rows.map((row) => ({
			status: row.status,
			count: row.count ?? 0,
		}));
	}

	/**
	 * Get average stage durations.
	 * Calculates time spent in each stage by finding consecutive transitions
	 * for the same workflow.
	 */
	async getStageDurations(
		filters?: AnalyticsFilters,
	): Promise<Array<{ stage: string; avgDuration: number; count: number }>> {
		let query = this.db
			.selectFrom("stage_transitions as t1")
			.innerJoin("stage_transitions as t2", (join) =>
				join.on(
					"t2.id",
					"=",
					sql<string>`(select t3.id from stage_transitions t3 where t3.workflow_id = t1.workflow_id and (t3.timestamp > t1.timestamp or (t3.timestamp = t1.timestamp and t3.id > t1.id)) order by t3.timestamp asc, t3.id asc limit 1)`,
				),
			)
			.select([
				"t1.new_stage as stage",
				sql<number>`avg(t2.timestamp - t1.timestamp)`.as("avg_duration"),
				sql<number>`count(*)`.as("count"),
			])
			.groupBy("t1.new_stage");

		query = this.applyFilters(query, filters, "t1.timestamp");

		const rows = await query.execute();

		return rows.map((row) => ({
			stage: row.stage,
			avgDuration: row.avg_duration ?? 0,
			count: row.count ?? 0,
		}));
	}

	/**
	 * Get failure patterns from workflow errors and pulse failures.
	 * Combines data from workflow_errors table and pulses table.
	 */
	async getFailurePatterns(filters?: AnalyticsFilters): Promise<{
		byStage: Array<{ stage: string; errorType: string; count: number }>;
		byErrorType: Array<{ errorType: string; count: number }>;
		pulseFailures: Array<{ failureReason: string; count: number }>;
	}> {
		// (a) Workflow errors grouped by stage and error_type
		let byStageQuery = this.db
			.selectFrom("workflow_errors")
			.select((eb) => [
				"stage",
				"error_type",
				eb.fn.count<number>("id").as("count"),
			])
			.groupBy(["stage", "error_type"]);

		byStageQuery = this.applyFilters(byStageQuery, filters);

		const byStageRows = await byStageQuery.execute();

		// (b) Workflow errors grouped by error_type only
		let byErrorTypeQuery = this.db
			.selectFrom("workflow_errors")
			.select((eb) => ["error_type", eb.fn.count<number>("id").as("count")])
			.groupBy("error_type");

		byErrorTypeQuery = this.applyFilters(byErrorTypeQuery, filters);

		const byErrorTypeRows = await byErrorTypeQuery.execute();

		// (c) Pulse failures grouped by failure_reason
		let pulseFailureQuery = this.db
			.selectFrom("pulses")
			.select((eb) => ["failure_reason", eb.fn.count<number>("id").as("count")])
			.where("status", "=", "failed")
			.where("failure_reason", "is not", null)
			.groupBy("failure_reason");

		pulseFailureQuery = this.applyFilters(
			pulseFailureQuery,
			filters,
			"created_at",
			{ useMilliseconds: true },
		);

		const pulseFailureRows = await pulseFailureQuery.execute();

		return {
			byStage: byStageRows.map((row) => ({
				stage: row.stage,
				errorType: row.error_type,
				count: row.count ?? 0,
			})),
			byErrorType: byErrorTypeRows.map((row) => ({
				errorType: row.error_type,
				count: row.count ?? 0,
			})),
			pulseFailures: pulseFailureRows.map((row) => ({
				failureReason: row.failure_reason as string,
				count: row.count ?? 0,
			})),
		};
	}

	/**
	 * Get workflow throughput over time.
	 * Counts completed workflows grouped by date bucket.
	 */
	async getThroughput(
		filters?: AnalyticsFilters,
	): Promise<Array<{ date: string; count: number }>> {
		const dateExpr = sql<string>`strftime('%Y-%m-%d', ${sql.ref("timestamp")}, 'unixepoch')`;

		let query = this.db
			.selectFrom("stage_transitions")
			.select([dateExpr.as("date"), sql<number>`count(*)`.as("count")])
			.where("new_stage", "=", "done")
			.groupBy(dateExpr)
			.orderBy(dateExpr, "asc");

		query = this.applyFilters(query, filters);

		const rows = await query.execute();

		return rows.map((row) => ({
			date: row.date,
			count: row.count ?? 0,
		}));
	}
}
