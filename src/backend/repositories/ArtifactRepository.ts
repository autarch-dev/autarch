/**
 * ArtifactRepository - Data access for workflow artifacts
 *
 * Handles ScopeCard, ResearchCard, and Plan entities.
 * These are the key deliverables produced during workflow stages.
 *
 * All JSON fields are validated on read/write using Zod schemas.
 */

import {
	ChallengesJsonSchema,
	DependenciesJsonSchema,
	IntegrationPointsJsonSchema,
	KeyFilesJsonSchema,
	PatternsJsonSchema,
	PulsesJsonSchema,
	parseJson,
	parseJsonOptional,
	RecommendationsJsonSchema,
	ScopeListSchema,
	stringifyJson,
	stringifyJsonOptional,
} from "@/backend/db/project/json-schemas";
import type {
	PlansTable,
	ResearchCardsTable,
	ReviewCardsTable,
	ReviewCommentSeverity,
	ReviewCommentsTable,
	ReviewCommentType,
	ReviewRecommendation,
	ScopeCardsTable,
} from "@/backend/db/project/types";
import { ids } from "@/backend/utils";
import type { PendingArtifactType } from "@/shared/schemas/events";
import type {
	ArtifactStatus as ArtifactStatusType,
	Challenge,
	Dependency,
	IntegrationPoint,
	KeyFile,
	Pattern,
	Plan,
	PulseDefinition,
	RecommendedPath,
	ResearchCard,
	ReviewCard,
	ReviewComment,
	ScopeCard,
} from "@/shared/schemas/workflow";
import type { ProjectDb, Repository } from "./types";

// =============================================================================
// Types
// =============================================================================

export interface CreateScopeCardData {
	workflowId: string;
	/** Turn ID this artifact was created in (for timeline ordering) */
	turnId?: string;
	title: string;
	description: string;
	inScope: string[];
	outOfScope: string[];
	constraints?: string[];
	recommendedPath: RecommendedPath;
	rationale?: string;
}

export interface CreateResearchCardData {
	workflowId: string;
	/** Turn ID this artifact was created in (for timeline ordering) */
	turnId?: string;
	summary: string;
	keyFiles: KeyFile[];
	patterns?: Pattern[];
	dependencies?: Dependency[];
	integrationPoints?: IntegrationPoint[];
	challenges?: Challenge[];
	recommendations: string[];
}

export interface CreatePlanData {
	workflowId: string;
	/** Turn ID this artifact was created in (for timeline ordering) */
	turnId?: string;
	approachSummary: string;
	pulses: PulseDefinition[];
}

export interface CreateReviewCardData {
	workflowId: string;
	/** Turn ID this artifact was created in (for timeline ordering) */
	turnId?: string;
}

export interface CreateReviewCommentData {
	reviewCardId: string;
	type: ReviewCommentType;
	filePath?: string;
	startLine?: number;
	endLine?: number;
	severity?: ReviewCommentSeverity;
	category?: string;
	description: string;
	author?: "agent" | "user";
}

// =============================================================================
// Repository
// =============================================================================

export class ArtifactRepository implements Repository {
	constructor(readonly db: ProjectDb) {}

	// ===========================================================================
	// Scope Card
	// ===========================================================================

	/**
	 * Convert a database row to a domain ScopeCard object.
	 * All JSON fields are validated against their schemas.
	 */
	private toScopeCard(row: ScopeCardsTable): ScopeCard {
		return {
			id: row.id,
			workflowId: row.workflow_id,
			turnId: row.turn_id ?? undefined,
			title: row.title,
			description: row.description,
			inScope: parseJson(
				row.in_scope_json,
				ScopeListSchema,
				"scope_card.in_scope_json",
			),
			outOfScope: parseJson(
				row.out_of_scope_json,
				ScopeListSchema,
				"scope_card.out_of_scope_json",
			),
			constraints: parseJsonOptional(
				row.constraints_json,
				ScopeListSchema,
				"scope_card.constraints_json",
			),
			recommendedPath: row.recommended_path,
			rationale: row.rationale ?? undefined,
			status: row.status,
			createdAt: row.created_at,
		};
	}

	/**
	 * Get the latest scope card for a workflow
	 */
	async getLatestScopeCard(workflowId: string): Promise<ScopeCard | null> {
		const row = await this.db
			.selectFrom("scope_cards")
			.selectAll()
			.where("workflow_id", "=", workflowId)
			.orderBy("created_at", "desc")
			.executeTakeFirst();

		return row ? this.toScopeCard(row) : null;
	}

	/**
	 * Create a new scope card
	 */
	async createScopeCard(data: CreateScopeCardData): Promise<ScopeCard> {
		const now = Date.now();
		const scopeCardId = ids.scopeCard();

		await this.db
			.insertInto("scope_cards")
			.values({
				id: scopeCardId,
				workflow_id: data.workflowId,
				turn_id: data.turnId ?? null,
				title: data.title,
				description: data.description,
				in_scope_json: stringifyJson(
					data.inScope,
					ScopeListSchema,
					"scope_card.in_scope_json",
				),
				out_of_scope_json: stringifyJson(
					data.outOfScope,
					ScopeListSchema,
					"scope_card.out_of_scope_json",
				),
				constraints_json: stringifyJsonOptional(
					data.constraints,
					ScopeListSchema,
					"scope_card.constraints_json",
				),
				recommended_path: data.recommendedPath,
				rationale: data.rationale ?? null,
				status: "pending",
				created_at: now,
			})
			.execute();

		const scopeCard = await this.getScopeCardById(scopeCardId);
		if (!scopeCard) {
			throw new Error(`Failed to create scope card: ${scopeCardId}`);
		}
		return scopeCard;
	}

	/**
	 * Get a scope card by ID
	 */
	private async getScopeCardById(id: string): Promise<ScopeCard | null> {
		const row = await this.db
			.selectFrom("scope_cards")
			.selectAll()
			.where("id", "=", id)
			.executeTakeFirst();

		return row ? this.toScopeCard(row) : null;
	}

	// ===========================================================================
	// Research Card
	// ===========================================================================

	/**
	 * Convert a database row to a domain ResearchCard object.
	 * All JSON fields are validated against their schemas.
	 */
	private toResearchCard(row: ResearchCardsTable): ResearchCard {
		return {
			id: row.id,
			workflowId: row.workflow_id,
			turnId: row.turn_id ?? undefined,
			summary: row.summary,
			keyFiles: parseJson(
				row.key_files_json,
				KeyFilesJsonSchema,
				"research_card.key_files_json",
			),
			patterns: parseJsonOptional(
				row.patterns_json,
				PatternsJsonSchema,
				"research_card.patterns_json",
			),
			dependencies: parseJsonOptional(
				row.dependencies_json,
				DependenciesJsonSchema,
				"research_card.dependencies_json",
			),
			integrationPoints: parseJsonOptional(
				row.integration_points_json,
				IntegrationPointsJsonSchema,
				"research_card.integration_points_json",
			),
			challenges: parseJsonOptional(
				row.challenges_json,
				ChallengesJsonSchema,
				"research_card.challenges_json",
			),
			recommendations: parseJson(
				row.recommendations_json,
				RecommendationsJsonSchema,
				"research_card.recommendations_json",
			),
			status: row.status,
			createdAt: row.created_at,
		};
	}

	/**
	 * Get the latest research card for a workflow
	 */
	async getLatestResearchCard(
		workflowId: string,
	): Promise<ResearchCard | null> {
		const row = await this.db
			.selectFrom("research_cards")
			.selectAll()
			.where("workflow_id", "=", workflowId)
			.orderBy("created_at", "desc")
			.executeTakeFirst();

		return row ? this.toResearchCard(row) : null;
	}

	/**
	 * Create a new research card
	 */
	async createResearchCard(
		data: CreateResearchCardData,
	): Promise<ResearchCard> {
		const now = Date.now();
		const researchCardId = ids.researchCard();

		await this.db
			.insertInto("research_cards")
			.values({
				id: researchCardId,
				workflow_id: data.workflowId,
				turn_id: data.turnId ?? null,
				summary: data.summary,
				key_files_json: stringifyJson(
					data.keyFiles,
					KeyFilesJsonSchema,
					"research_card.key_files_json",
				),
				patterns_json: stringifyJsonOptional(
					data.patterns,
					PatternsJsonSchema,
					"research_card.patterns_json",
				),
				dependencies_json: stringifyJsonOptional(
					data.dependencies,
					DependenciesJsonSchema,
					"research_card.dependencies_json",
				),
				integration_points_json: stringifyJsonOptional(
					data.integrationPoints,
					IntegrationPointsJsonSchema,
					"research_card.integration_points_json",
				),
				challenges_json: stringifyJsonOptional(
					data.challenges,
					ChallengesJsonSchema,
					"research_card.challenges_json",
				),
				recommendations_json: stringifyJson(
					data.recommendations,
					RecommendationsJsonSchema,
					"research_card.recommendations_json",
				),
				status: "pending",
				created_at: now,
			})
			.execute();

		const researchCard = await this.getResearchCardById(researchCardId);
		if (!researchCard) {
			throw new Error(`Failed to create research card: ${researchCardId}`);
		}
		return researchCard;
	}

	/**
	 * Get a research card by ID
	 */
	private async getResearchCardById(id: string): Promise<ResearchCard | null> {
		const row = await this.db
			.selectFrom("research_cards")
			.selectAll()
			.where("id", "=", id)
			.executeTakeFirst();

		return row ? this.toResearchCard(row) : null;
	}

	// ===========================================================================
	// Plan
	// ===========================================================================

	/**
	 * Convert a database row to a domain Plan object.
	 * All JSON fields are validated against their schemas.
	 */
	private toPlan(row: PlansTable): Plan {
		return {
			id: row.id,
			workflowId: row.workflow_id,
			turnId: row.turn_id ?? undefined,
			approachSummary: row.approach_summary,
			pulses: parseJson(row.pulses_json, PulsesJsonSchema, "plan.pulses_json"),
			status: row.status,
			createdAt: row.created_at,
		};
	}

	/**
	 * Get the latest plan for a workflow
	 */
	async getLatestPlan(workflowId: string): Promise<Plan | null> {
		const row = await this.db
			.selectFrom("plans")
			.selectAll()
			.where("workflow_id", "=", workflowId)
			.orderBy("created_at", "desc")
			.executeTakeFirst();

		return row ? this.toPlan(row) : null;
	}

	/**
	 * Create a new plan
	 */
	async createPlan(data: CreatePlanData): Promise<Plan> {
		const now = Date.now();
		const planId = ids.plan();

		await this.db
			.insertInto("plans")
			.values({
				id: planId,
				workflow_id: data.workflowId,
				turn_id: data.turnId ?? null,
				approach_summary: data.approachSummary,
				pulses_json: stringifyJson(
					data.pulses,
					PulsesJsonSchema,
					"plan.pulses_json",
				),
				status: "pending",
				created_at: now,
			})
			.execute();

		const plan = await this.getPlanById(planId);
		if (!plan) {
			throw new Error(`Failed to create plan: ${planId}`);
		}
		return plan;
	}

	/**
	 * Get a plan by ID
	 */
	private async getPlanById(id: string): Promise<Plan | null> {
		const row = await this.db
			.selectFrom("plans")
			.selectAll()
			.where("id", "=", id)
			.executeTakeFirst();

		return row ? this.toPlan(row) : null;
	}

	// ===========================================================================
	// Review Card
	// ===========================================================================

	/**
	 * Convert a database row to a domain ReviewComment object.
	 */
	private toReviewComment(row: ReviewCommentsTable): ReviewComment {
		return {
			id: row.id,
			reviewCardId: row.review_card_id,
			type: row.type,
			filePath: row.file_path ?? undefined,
			startLine: row.start_line ?? undefined,
			endLine: row.end_line ?? undefined,
			severity: row.severity ?? undefined,
			category: row.category ?? undefined,
			description: row.description,
			author: (row.author as "agent" | "user") ?? "agent",
			createdAt: row.created_at,
		};
	}

	/**
	 * Convert a database row to a domain ReviewCard object.
	 * Fetches associated comments from review_comments table.
	 */
	private async toReviewCard(
		row: ReviewCardsTable,
		comments: ReviewComment[],
	): Promise<ReviewCard> {
		return {
			id: row.id,
			workflowId: row.workflow_id,
			turnId: row.turn_id ?? undefined,
			recommendation: row.recommendation ?? undefined,
			summary: row.summary ?? undefined,
			comments,
			status: row.status,
			createdAt: row.created_at,
		};
	}

	/**
	 * Get the latest review card for a workflow
	 */
	async getLatestReviewCard(workflowId: string): Promise<ReviewCard | null> {
		const row = await this.db
			.selectFrom("review_cards")
			.selectAll()
			.where("workflow_id", "=", workflowId)
			.orderBy("created_at", "desc")
			.executeTakeFirst();

		if (!row) {
			return null;
		}

		const comments = await this.getCommentsByReviewCard(row.id);
		return this.toReviewCard(row, comments);
	}

	/**
	 * Get all review cards for a workflow, ordered by creation date (oldest first)
	 */
	async getAllReviewCards(workflowId: string): Promise<ReviewCard[]> {
		const rows = await this.db
			.selectFrom("review_cards")
			.selectAll()
			.where("workflow_id", "=", workflowId)
			.orderBy("created_at", "asc")
			.execute();

		const reviewCards: ReviewCard[] = [];
		for (const row of rows) {
			const comments = await this.getCommentsByReviewCard(row.id);
			reviewCards.push(await this.toReviewCard(row, comments));
		}
		return reviewCards;
	}

	/**
	 * Create a new review card.
	 * Initially created with no recommendation/summary - those are set by completeReview.
	 */
	async createReviewCard(data: CreateReviewCardData): Promise<ReviewCard> {
		const now = Date.now();
		const reviewCardId = ids.reviewCard();

		await this.db
			.insertInto("review_cards")
			.values({
				id: reviewCardId,
				workflow_id: data.workflowId,
				turn_id: data.turnId ?? null,
				recommendation: null,
				summary: null,
				status: "pending",
				created_at: now,
			})
			.execute();

		const reviewCard = await this.getReviewCardById(reviewCardId);
		if (!reviewCard) {
			throw new Error(`Failed to create review card: ${reviewCardId}`);
		}
		return reviewCard;
	}

	/**
	 * Get a review card by ID
	 */
	private async getReviewCardById(id: string): Promise<ReviewCard | null> {
		const row = await this.db
			.selectFrom("review_cards")
			.selectAll()
			.where("id", "=", id)
			.executeTakeFirst();

		if (!row) {
			return null;
		}

		const comments = await this.getCommentsByReviewCard(row.id);
		return this.toReviewCard(row, comments);
	}

	/**
	 * Update the status of a review card
	 */
	async updateReviewCardStatus(
		id: string,
		status: ArtifactStatusType,
	): Promise<void> {
		await this.db
			.updateTable("review_cards")
			.set({ status })
			.where("id", "=", id)
			.execute();
	}

	/**
	 * Update a review card with recommendation and summary (called by completeReview tool)
	 */
	async updateReviewCardCompletion(
		id: string,
		recommendation: ReviewRecommendation,
		summary: string,
	): Promise<void> {
		await this.db
			.updateTable("review_cards")
			.set({ recommendation, summary })
			.where("id", "=", id)
			.execute();
	}

	/**
	 * Set the turn_id for review cards that don't have one yet.
	 * Called when a review agent's first turn starts.
	 */
	async setReviewCardTurnId(workflowId: string, turnId: string): Promise<void> {
		await this.db
			.updateTable("review_cards")
			.set({ turn_id: turnId })
			.where("workflow_id", "=", workflowId)
			.where("turn_id", "is", null)
			.execute();
	}

	/**
	 * Update the turn_id on the latest review card for a workflow.
	 * Used by complete_review to ensure the card is linked to the completing turn.
	 */
	async updateLatestReviewCardTurnId(
		workflowId: string,
		turnId: string,
	): Promise<void> {
		const reviewCard = await this.getLatestReviewCard(workflowId);
		if (reviewCard) {
			await this.db
				.updateTable("review_cards")
				.set({ turn_id: turnId })
				.where("id", "=", reviewCard.id)
				.execute();
		}
	}

	// ===========================================================================
	// Review Comments
	// ===========================================================================

	/**
	 * Create a new review comment
	 */
	async createReviewComment(
		data: CreateReviewCommentData,
	): Promise<ReviewComment> {
		const now = Date.now();
		const commentId = ids.reviewComment();

		await this.db
			.insertInto("review_comments")
			.values({
				id: commentId,
				review_card_id: data.reviewCardId,
				type: data.type,
				file_path: data.filePath ?? null,
				start_line: data.startLine ?? null,
				end_line: data.endLine ?? null,
				severity: data.severity ?? null,
				category: data.category ?? null,
				description: data.description,
				author: data.author ?? "agent",
				created_at: now,
			})
			.execute();

		const comment = await this.getReviewCommentById(commentId);
		if (!comment) {
			throw new Error(`Failed to create review comment: ${commentId}`);
		}
		return comment;
	}

	/**
	 * Get a review comment by ID
	 */
	private async getReviewCommentById(
		id: string,
	): Promise<ReviewComment | null> {
		const row = await this.db
			.selectFrom("review_comments")
			.selectAll()
			.where("id", "=", id)
			.executeTakeFirst();

		return row ? this.toReviewComment(row) : null;
	}

	/**
	 * Get all comments for a review card, ordered by creation date (oldest first)
	 */
	async getCommentsByReviewCard(
		reviewCardId: string,
	): Promise<ReviewComment[]> {
		const rows = await this.db
			.selectFrom("review_comments")
			.selectAll()
			.where("review_card_id", "=", reviewCardId)
			.orderBy("created_at", "asc")
			.execute();

		return rows.map((row) => this.toReviewComment(row));
	}

	/**
	 * Delete all comments for a review card
	 */
	async deleteReviewComments(reviewCardId: string): Promise<void> {
		await this.db
			.deleteFrom("review_comments")
			.where("review_card_id", "=", reviewCardId)
			.execute();
	}

	/**
	 * Reset a review card to pending state, clearing recommendation and summary
	 */
	async resetReviewCard(reviewCardId: string): Promise<void> {
		await this.db
			.updateTable("review_cards")
			.set({
				status: "pending",
				recommendation: null,
				summary: null,
			})
			.where("id", "=", reviewCardId)
			.execute();
	}

	/**
	 * Get comments by their IDs (for fetching selected comments for fix requests)
	 */
	async getCommentsByIds(ids: string[]): Promise<ReviewComment[]> {
		if (ids.length === 0) {
			return [];
		}

		const rows = await this.db
			.selectFrom("review_comments")
			.selectAll()
			.where("id", "in", ids)
			.orderBy("created_at", "asc")
			.execute();

		return rows.map((row) => this.toReviewComment(row));
	}

	// ===========================================================================
	// Generic Artifact Access
	// ===========================================================================

	/**
	 * Get the pending artifact for a workflow based on artifact type.
	 * Used by history endpoints to fetch the appropriate pending artifact.
	 */
	async getPendingArtifact(
		workflowId: string,
		artifactType: PendingArtifactType | null | undefined,
	): Promise<ScopeCard | ResearchCard | Plan | ReviewCard | null> {
		if (!artifactType) {
			return null;
		}

		switch (artifactType) {
			case "scope_card":
				return this.getLatestScopeCard(workflowId);
			case "research":
				return this.getLatestResearchCard(workflowId);
			case "plan":
				return this.getLatestPlan(workflowId);
			case "review_card":
				return this.getLatestReviewCard(workflowId);
			default:
				return null;
		}
	}

	// ===========================================================================
	// Status Update Methods
	// ===========================================================================

	/**
	 * Update the status of a scope card
	 */
	async updateScopeCardStatus(
		id: string,
		status: ArtifactStatusType,
	): Promise<void> {
		await this.db
			.updateTable("scope_cards")
			.set({ status })
			.where("id", "=", id)
			.execute();
	}

	/**
	 * Update the status of a research card
	 */
	async updateResearchCardStatus(
		id: string,
		status: ArtifactStatusType,
	): Promise<void> {
		await this.db
			.updateTable("research_cards")
			.set({ status })
			.where("id", "=", id)
			.execute();
	}

	/**
	 * Update the status of a plan
	 */
	async updatePlanStatus(
		id: string,
		status: ArtifactStatusType,
	): Promise<void> {
		await this.db
			.updateTable("plans")
			.set({ status })
			.where("id", "=", id)
			.execute();
	}

	// ===========================================================================
	// Get All Artifacts Methods (for history display)
	// ===========================================================================

	/**
	 * Get all scope cards for a workflow, ordered by creation date (oldest first)
	 */
	async getAllScopeCards(workflowId: string): Promise<ScopeCard[]> {
		const rows = await this.db
			.selectFrom("scope_cards")
			.selectAll()
			.where("workflow_id", "=", workflowId)
			.orderBy("created_at", "asc")
			.execute();

		return rows.map((row) => this.toScopeCard(row));
	}

	/**
	 * Get all research cards for a workflow, ordered by creation date (oldest first)
	 */
	async getAllResearchCards(workflowId: string): Promise<ResearchCard[]> {
		const rows = await this.db
			.selectFrom("research_cards")
			.selectAll()
			.where("workflow_id", "=", workflowId)
			.orderBy("created_at", "asc")
			.execute();

		return rows.map((row) => this.toResearchCard(row));
	}

	/**
	 * Get all plans for a workflow, ordered by creation date (oldest first)
	 */
	async getAllPlans(workflowId: string): Promise<Plan[]> {
		const rows = await this.db
			.selectFrom("plans")
			.selectAll()
			.where("workflow_id", "=", workflowId)
			.orderBy("created_at", "asc")
			.execute();

		return rows.map((row) => this.toPlan(row));
	}

	// ===========================================================================
	// Deletion Methods (for rewind operations)
	// ===========================================================================

	/**
	 * Delete all research cards for a workflow
	 */
	async deleteResearchCardsByWorkflow(workflowId: string): Promise<void> {
		await this.db
			.deleteFrom("research_cards")
			.where("workflow_id", "=", workflowId)
			.execute();
	}

	/**
	 * Delete all plans for a workflow
	 */
	async deletePlansByWorkflow(workflowId: string): Promise<void> {
		await this.db
			.deleteFrom("plans")
			.where("workflow_id", "=", workflowId)
			.execute();
	}

	/**
	 * Delete all review cards and their comments for a workflow
	 */
	async deleteReviewCardsByWorkflow(workflowId: string): Promise<void> {
		// First get review card IDs to delete their comments
		const reviewCards = await this.db
			.selectFrom("review_cards")
			.select("id")
			.where("workflow_id", "=", workflowId)
			.execute();

		// Delete comments for all review cards
		if (reviewCards.length > 0) {
			const reviewCardIds = reviewCards.map((r) => r.id);
			await this.db
				.deleteFrom("review_comments")
				.where("review_card_id", "in", reviewCardIds)
				.execute();
		}

		// Delete review cards
		await this.db
			.deleteFrom("review_cards")
			.where("workflow_id", "=", workflowId)
			.execute();
	}
}
