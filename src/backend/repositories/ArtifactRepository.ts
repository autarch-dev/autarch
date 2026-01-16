/**
 * ArtifactRepository - Data access for workflow artifacts
 *
 * Handles ScopeCard, ResearchCard, and Plan entities.
 * These are the key deliverables produced during workflow stages.
 */

import type {
	PlansTable,
	ResearchCardsTable,
	ScopeCardsTable,
} from "@/backend/db/project/types";
import { ids } from "@/backend/utils";
import type { PendingArtifactType } from "@/shared/schemas/events";
import type {
	Challenge,
	Dependency,
	IntegrationPoint,
	KeyFile,
	Pattern,
	Plan,
	PulseDefinition,
	RecommendedPath,
	ResearchCard,
	ScopeCard,
} from "@/shared/schemas/workflow";
import type { ProjectDb, Repository } from "./types";

// =============================================================================
// Types
// =============================================================================

export interface CreateScopeCardData {
	workflowId: string;
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
	approachSummary: string;
	pulses: PulseDefinition[];
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
	 */
	private toScopeCard(row: ScopeCardsTable): ScopeCard {
		return {
			id: row.id,
			workflowId: row.workflow_id,
			title: row.title,
			description: row.description,
			inScope: JSON.parse(row.in_scope_json),
			outOfScope: JSON.parse(row.out_of_scope_json),
			constraints: row.constraints_json
				? JSON.parse(row.constraints_json)
				: undefined,
			recommendedPath: row.recommended_path,
			rationale: row.rationale ?? undefined,
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
				title: data.title,
				description: data.description,
				in_scope_json: JSON.stringify(data.inScope),
				out_of_scope_json: JSON.stringify(data.outOfScope),
				constraints_json: data.constraints
					? JSON.stringify(data.constraints)
					: null,
				recommended_path: data.recommendedPath,
				rationale: data.rationale ?? null,
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
	 */
	private toResearchCard(row: ResearchCardsTable): ResearchCard {
		return {
			id: row.id,
			workflowId: row.workflow_id,
			summary: row.summary,
			keyFiles: JSON.parse(row.key_files_json),
			patterns: row.patterns_json ? JSON.parse(row.patterns_json) : undefined,
			dependencies: row.dependencies_json
				? JSON.parse(row.dependencies_json)
				: undefined,
			integrationPoints: row.integration_points_json
				? JSON.parse(row.integration_points_json)
				: undefined,
			challenges: row.challenges_json
				? JSON.parse(row.challenges_json)
				: undefined,
			recommendations: JSON.parse(row.recommendations_json),
			createdAt: row.created_at,
		};
	}

	/**
	 * Get the latest research card for a workflow
	 */
	async getLatestResearchCard(workflowId: string): Promise<ResearchCard | null> {
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
	async createResearchCard(data: CreateResearchCardData): Promise<ResearchCard> {
		const now = Date.now();
		const researchCardId = ids.researchCard();

		await this.db
			.insertInto("research_cards")
			.values({
				id: researchCardId,
				workflow_id: data.workflowId,
				summary: data.summary,
				key_files_json: JSON.stringify(data.keyFiles),
				patterns_json: data.patterns ? JSON.stringify(data.patterns) : null,
				dependencies_json: data.dependencies
					? JSON.stringify(data.dependencies)
					: null,
				integration_points_json: data.integrationPoints
					? JSON.stringify(data.integrationPoints)
					: null,
				challenges_json: data.challenges
					? JSON.stringify(data.challenges)
					: null,
				recommendations_json: JSON.stringify(data.recommendations),
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
	 */
	private toPlan(row: PlansTable): Plan {
		return {
			id: row.id,
			workflowId: row.workflow_id,
			approachSummary: row.approach_summary,
			pulses: JSON.parse(row.pulses_json),
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
				approach_summary: data.approachSummary,
				pulses_json: JSON.stringify(data.pulses),
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
	// Generic Artifact Access
	// ===========================================================================

	/**
	 * Get the pending artifact for a workflow based on artifact type.
	 * Used by history endpoints to fetch the appropriate pending artifact.
	 */
	async getPendingArtifact(
		workflowId: string,
		artifactType: PendingArtifactType | null | undefined,
	): Promise<ScopeCard | ResearchCard | Plan | null> {
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
			default:
				return null;
		}
	}
}
