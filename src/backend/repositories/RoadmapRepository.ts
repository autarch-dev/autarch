/**
 * RoadmapRepository - Data access for roadmap entities
 *
 * Handles Roadmap, Milestone, Initiative, VisionDocument, and Dependency entities.
 * Provides CRUD operations and composite queries for the roadmap feature.
 */

import type {
	DependencyTable,
	InitiativeTable,
	MilestoneTable,
	RoadmapTable,
	VisionDocumentTable,
} from "@/backend/db/project/types";
import { ids } from "@/backend/utils";
import type {
	Initiative,
	InitiativePriority,
	InitiativeStatus,
	Milestone,
	ProgressMode,
	Roadmap,
	RoadmapDependency,
	RoadmapDependencyNodeType,
	RoadmapStatus,
	VisionDocument,
} from "@/shared/schemas/roadmap";
import type { ProjectDb, Repository } from "./types";

// =============================================================================
// Types
// =============================================================================

export interface CreateRoadmapData {
	title: string;
	description?: string;
	status?: RoadmapStatus;
}

export interface UpdateRoadmapData {
	title?: string;
	description?: string;
	status?: RoadmapStatus;
	currentSessionId?: string | null;
}

export interface CreateMilestoneData {
	roadmapId: string;
	title: string;
	description?: string;
	startDate?: number;
	endDate?: number;
	sortOrder: number;
}

export interface UpdateMilestoneData {
	title?: string;
	description?: string;
	startDate?: number | null;
	endDate?: number | null;
	sortOrder?: number;
}

export interface CreateInitiativeData {
	milestoneId: string;
	roadmapId: string;
	title: string;
	description?: string;
	status?: InitiativeStatus;
	priority?: InitiativePriority;
	progress?: number;
	progressMode?: ProgressMode;
	workflowId?: string;
	sortOrder: number;
}

export interface UpdateInitiativeData {
	title?: string;
	description?: string;
	status?: InitiativeStatus;
	priority?: InitiativePriority;
	progress?: number;
	progressMode?: ProgressMode;
	workflowId?: string | null;
	milestoneId?: string;
	sortOrder?: number;
}

export interface CreateDependencyData {
	sourceType: RoadmapDependencyNodeType;
	sourceId: string;
	targetType: RoadmapDependencyNodeType;
	targetId: string;
}

export interface RoadmapWithDetails {
	roadmap: Roadmap;
	milestones: Milestone[];
	initiatives: Initiative[];
	visionDocument: VisionDocument | null;
	dependencies: RoadmapDependency[];
}

// =============================================================================
// Repository
// =============================================================================

export class RoadmapRepository implements Repository {
	constructor(readonly db: ProjectDb) {}

	// ===========================================================================
	// Domain Mapping
	// ===========================================================================

	/**
	 * Convert a database row to a domain Roadmap object.
	 */
	private toRoadmap(row: RoadmapTable): Roadmap {
		return {
			id: row.id,
			title: row.title,
			description: row.description ?? undefined,
			status: row.status as RoadmapStatus,
			currentSessionId: row.current_session_id ?? undefined,
			createdAt: row.created_at,
			updatedAt: row.updated_at,
		};
	}

	/**
	 * Convert a database row to a domain Milestone object.
	 */
	private toMilestone(row: MilestoneTable): Milestone {
		return {
			id: row.id,
			roadmapId: row.roadmap_id,
			title: row.title,
			description: row.description ?? undefined,
			startDate: row.start_date ?? undefined,
			endDate: row.end_date ?? undefined,
			sortOrder: row.sort_order,
			createdAt: row.created_at,
			updatedAt: row.updated_at,
		};
	}

	/**
	 * Convert a database row to a domain Initiative object.
	 */
	private toInitiative(row: InitiativeTable): Initiative {
		return {
			id: row.id,
			milestoneId: row.milestone_id,
			roadmapId: row.roadmap_id,
			title: row.title,
			description: row.description ?? undefined,
			status: row.status as InitiativeStatus,
			priority: row.priority as InitiativePriority,
			progress: row.progress,
			progressMode: row.progress_mode as ProgressMode,
			workflowId: row.workflow_id ?? undefined,
			sortOrder: row.sort_order,
			createdAt: row.created_at,
			updatedAt: row.updated_at,
		};
	}

	/**
	 * Convert a database row to a domain VisionDocument object.
	 */
	private toVisionDocument(row: VisionDocumentTable): VisionDocument {
		return {
			id: row.id,
			roadmapId: row.roadmap_id,
			content: row.content,
			createdAt: row.created_at,
			updatedAt: row.updated_at,
		};
	}

	/**
	 * Convert a database row to a domain RoadmapDependency object.
	 */
	private toDependency(row: DependencyTable): RoadmapDependency {
		return {
			id: row.id,
			sourceType: row.source_type as RoadmapDependencyNodeType,
			sourceId: row.source_id,
			targetType: row.target_type as RoadmapDependencyNodeType,
			targetId: row.target_id,
			createdAt: row.created_at,
		};
	}

	// ===========================================================================
	// Roadmap CRUD
	// ===========================================================================

	/**
	 * Create a new roadmap
	 */
	async createRoadmap(data: CreateRoadmapData): Promise<Roadmap> {
		const now = Date.now();
		const roadmapId = ids.roadmap();

		await this.db
			.insertInto("roadmaps")
			.values({
				id: roadmapId,
				title: data.title,
				description: data.description ?? null,
				status: data.status ?? "draft",
				current_session_id: null,
				created_at: now,
				updated_at: now,
			})
			.execute();

		const roadmap = await this.getRoadmap(roadmapId);
		if (!roadmap) {
			throw new Error(`Failed to create roadmap: ${roadmapId}`);
		}
		return roadmap;
	}

	/**
	 * Get a roadmap by ID
	 */
	async getRoadmap(id: string): Promise<Roadmap | null> {
		const row = await this.db
			.selectFrom("roadmaps")
			.selectAll()
			.where("id", "=", id)
			.executeTakeFirst();

		return row ? this.toRoadmap(row) : null;
	}

	/**
	 * List all roadmaps, ordered by most recently updated
	 */
	async listRoadmaps(): Promise<Roadmap[]> {
		const rows = await this.db
			.selectFrom("roadmaps")
			.selectAll()
			.orderBy("updated_at", "desc")
			.execute();

		return rows.map((row) => this.toRoadmap(row));
	}

	/**
	 * Update a roadmap
	 */
	async updateRoadmap(id: string, data: UpdateRoadmapData): Promise<Roadmap> {
		const updates: Record<string, unknown> = {
			updated_at: Date.now(),
		};

		if (data.title !== undefined) updates.title = data.title;
		if (data.description !== undefined)
			updates.description = data.description ?? null;
		if (data.status !== undefined) updates.status = data.status;
		if (data.currentSessionId !== undefined)
			updates.current_session_id = data.currentSessionId ?? null;

		await this.db
			.updateTable("roadmaps")
			.set(updates)
			.where("id", "=", id)
			.execute();

		const roadmap = await this.getRoadmap(id);
		if (!roadmap) {
			throw new Error(`Roadmap not found: ${id}`);
		}
		return roadmap;
	}

	/**
	 * Delete a roadmap and all associated data (milestones, initiatives, vision, dependencies)
	 */
	async deleteRoadmap(id: string): Promise<void> {
		await this.db.transaction().execute(async (trx) => {
			// Delete dependencies that reference initiatives or milestones in this roadmap
			const milestones = await trx
				.selectFrom("milestones")
				.select("id")
				.where("roadmap_id", "=", id)
				.execute();

			const milestoneIds = milestones.map((m) => m.id);

			const initiatives = await trx
				.selectFrom("initiatives")
				.select("id")
				.where("roadmap_id", "=", id)
				.execute();

			const initiativeIds = initiatives.map((i) => i.id);

			const allNodeIds = [...milestoneIds, ...initiativeIds];
			if (allNodeIds.length > 0) {
				await trx
					.deleteFrom("dependencies")
					.where((eb) =>
						eb.or([
							eb("source_id", "in", allNodeIds),
							eb("target_id", "in", allNodeIds),
						]),
					)
					.execute();
			}

			// Delete initiatives
			await trx
				.deleteFrom("initiatives")
				.where("roadmap_id", "=", id)
				.execute();

			// Delete milestones
			await trx.deleteFrom("milestones").where("roadmap_id", "=", id).execute();

			// Delete vision document
			await trx
				.deleteFrom("vision_documents")
				.where("roadmap_id", "=", id)
				.execute();

			// Delete roadmap
			await trx.deleteFrom("roadmaps").where("id", "=", id).execute();
		});
	}

	// ===========================================================================
	// Milestone CRUD
	// ===========================================================================

	/**
	 * Create a new milestone
	 */
	async createMilestone(data: CreateMilestoneData): Promise<Milestone> {
		const now = Date.now();
		const milestoneId = ids.milestone();

		await this.db
			.insertInto("milestones")
			.values({
				id: milestoneId,
				roadmap_id: data.roadmapId,
				title: data.title,
				description: data.description ?? null,
				start_date: data.startDate ?? null,
				end_date: data.endDate ?? null,
				sort_order: data.sortOrder,
				created_at: now,
				updated_at: now,
			})
			.execute();

		const milestone = await this.getMilestone(milestoneId);
		if (!milestone) {
			throw new Error(`Failed to create milestone: ${milestoneId}`);
		}
		return milestone;
	}

	/**
	 * Get a milestone by ID
	 */
	async getMilestone(id: string): Promise<Milestone | null> {
		const row = await this.db
			.selectFrom("milestones")
			.selectAll()
			.where("id", "=", id)
			.executeTakeFirst();

		return row ? this.toMilestone(row) : null;
	}

	/**
	 * List milestones for a roadmap, ordered by sort_order
	 */
	async listMilestones(roadmapId: string): Promise<Milestone[]> {
		const rows = await this.db
			.selectFrom("milestones")
			.selectAll()
			.where("roadmap_id", "=", roadmapId)
			.orderBy("sort_order", "asc")
			.execute();

		return rows.map((row) => this.toMilestone(row));
	}

	/**
	 * Update a milestone
	 */
	async updateMilestone(
		id: string,
		data: UpdateMilestoneData,
	): Promise<Milestone> {
		const updates: Record<string, unknown> = {
			updated_at: Date.now(),
		};

		if (data.title !== undefined) updates.title = data.title;
		if (data.description !== undefined)
			updates.description = data.description ?? null;
		if (data.startDate !== undefined)
			updates.start_date = data.startDate ?? null;
		if (data.endDate !== undefined) updates.end_date = data.endDate ?? null;
		if (data.sortOrder !== undefined) updates.sort_order = data.sortOrder;

		await this.db
			.updateTable("milestones")
			.set(updates)
			.where("id", "=", id)
			.execute();

		const milestone = await this.getMilestone(id);
		if (!milestone) {
			throw new Error(`Milestone not found: ${id}`);
		}
		return milestone;
	}

	/**
	 * Delete a milestone and cascade delete its initiatives
	 */
	async deleteMilestone(id: string): Promise<void> {
		await this.db.transaction().execute(async (trx) => {
			// Delete dependencies referencing initiatives under this milestone
			const initiatives = await trx
				.selectFrom("initiatives")
				.select("id")
				.where("milestone_id", "=", id)
				.execute();

			const initiativeIds = initiatives.map((i) => i.id);
			const allNodeIds = [id, ...initiativeIds];

			if (allNodeIds.length > 0) {
				await trx
					.deleteFrom("dependencies")
					.where((eb) =>
						eb.or([
							eb("source_id", "in", allNodeIds),
							eb("target_id", "in", allNodeIds),
						]),
					)
					.execute();
			}

			// Delete initiatives under this milestone
			await trx
				.deleteFrom("initiatives")
				.where("milestone_id", "=", id)
				.execute();

			// Delete the milestone
			await trx.deleteFrom("milestones").where("id", "=", id).execute();
		});
	}

	// ===========================================================================
	// Initiative CRUD
	// ===========================================================================

	/**
	 * Create a new initiative
	 */
	async createInitiative(data: CreateInitiativeData): Promise<Initiative> {
		const now = Date.now();
		const initiativeId = ids.initiative();

		await this.db
			.insertInto("initiatives")
			.values({
				id: initiativeId,
				milestone_id: data.milestoneId,
				roadmap_id: data.roadmapId,
				title: data.title,
				description: data.description ?? null,
				status: data.status ?? "not_started",
				priority: data.priority ?? "medium",
				progress: data.progress ?? 0,
				progress_mode: data.progressMode ?? "manual",
				workflow_id: data.workflowId ?? null,
				sort_order: data.sortOrder,
				created_at: now,
				updated_at: now,
			})
			.execute();

		const initiative = await this.getInitiative(initiativeId);
		if (!initiative) {
			throw new Error(`Failed to create initiative: ${initiativeId}`);
		}
		return initiative;
	}

	/**
	 * Get an initiative by ID
	 */
	async getInitiative(id: string): Promise<Initiative | null> {
		const row = await this.db
			.selectFrom("initiatives")
			.selectAll()
			.where("id", "=", id)
			.executeTakeFirst();

		return row ? this.toInitiative(row) : null;
	}

	/**
	 * List initiatives for a milestone, ordered by sort_order
	 */
	async listInitiatives(milestoneId: string): Promise<Initiative[]> {
		const rows = await this.db
			.selectFrom("initiatives")
			.selectAll()
			.where("milestone_id", "=", milestoneId)
			.orderBy("sort_order", "asc")
			.execute();

		return rows.map((row) => this.toInitiative(row));
	}

	/**
	 * List all initiatives for a roadmap, ordered by sort_order
	 */
	async listInitiativesByRoadmap(roadmapId: string): Promise<Initiative[]> {
		const rows = await this.db
			.selectFrom("initiatives")
			.selectAll()
			.where("roadmap_id", "=", roadmapId)
			.orderBy("sort_order", "asc")
			.execute();

		return rows.map((row) => this.toInitiative(row));
	}

	/**
	 * Update an initiative
	 */
	async updateInitiative(
		id: string,
		data: UpdateInitiativeData,
	): Promise<Initiative> {
		const updates: Record<string, unknown> = {
			updated_at: Date.now(),
		};

		if (data.title !== undefined) updates.title = data.title;
		if (data.description !== undefined)
			updates.description = data.description ?? null;
		if (data.status !== undefined) updates.status = data.status;
		if (data.priority !== undefined) updates.priority = data.priority;
		if (data.progress !== undefined) updates.progress = data.progress;
		if (data.progressMode !== undefined)
			updates.progress_mode = data.progressMode;
		if (data.workflowId !== undefined)
			updates.workflow_id = data.workflowId ?? null;
		if (data.milestoneId !== undefined) updates.milestone_id = data.milestoneId;
		if (data.sortOrder !== undefined) updates.sort_order = data.sortOrder;

		await this.db
			.updateTable("initiatives")
			.set(updates)
			.where("id", "=", id)
			.execute();

		const initiative = await this.getInitiative(id);
		if (!initiative) {
			throw new Error(`Initiative not found: ${id}`);
		}
		return initiative;
	}

	/**
	 * Delete an initiative and its dependencies
	 */
	async deleteInitiative(id: string): Promise<void> {
		await this.db.transaction().execute(async (trx) => {
			// Delete dependencies referencing this initiative
			await trx
				.deleteFrom("dependencies")
				.where((eb) =>
					eb.or([eb("source_id", "=", id), eb("target_id", "=", id)]),
				)
				.execute();

			// Delete the initiative
			await trx.deleteFrom("initiatives").where("id", "=", id).execute();
		});
	}

	// ===========================================================================
	// Vision Document
	// ===========================================================================

	/**
	 * Get the vision document for a roadmap
	 */
	async getVisionDocument(roadmapId: string): Promise<VisionDocument | null> {
		const row = await this.db
			.selectFrom("vision_documents")
			.selectAll()
			.where("roadmap_id", "=", roadmapId)
			.executeTakeFirst();

		return row ? this.toVisionDocument(row) : null;
	}

	/**
	 * Create or update the vision document for a roadmap
	 */
	async upsertVisionDocument(
		roadmapId: string,
		content: string,
	): Promise<VisionDocument> {
		const existing = await this.getVisionDocument(roadmapId);
		const now = Date.now();

		if (existing) {
			await this.db
				.updateTable("vision_documents")
				.set({
					content,
					updated_at: now,
				})
				.where("roadmap_id", "=", roadmapId)
				.execute();
		} else {
			const visionId = ids.vision();
			await this.db
				.insertInto("vision_documents")
				.values({
					id: visionId,
					roadmap_id: roadmapId,
					content,
					created_at: now,
					updated_at: now,
				})
				.execute();
		}

		const visionDocument = await this.getVisionDocument(roadmapId);
		if (!visionDocument) {
			throw new Error(
				`Failed to upsert vision document for roadmap: ${roadmapId}`,
			);
		}
		return visionDocument;
	}

	// ===========================================================================
	// Dependencies
	// ===========================================================================

	/**
	 * Create a new dependency
	 */
	async createDependency(
		data: CreateDependencyData,
	): Promise<RoadmapDependency> {
		const now = Date.now();
		const dependencyId = ids.dep();

		await this.db
			.insertInto("dependencies")
			.values({
				id: dependencyId,
				source_type: data.sourceType,
				source_id: data.sourceId,
				target_type: data.targetType,
				target_id: data.targetId,
				created_at: now,
			})
			.execute();

		const row = await this.db
			.selectFrom("dependencies")
			.selectAll()
			.where("id", "=", dependencyId)
			.executeTakeFirst();

		if (!row) {
			throw new Error(`Failed to create dependency: ${dependencyId}`);
		}
		return this.toDependency(row);
	}

	/**
	 * List all dependencies for a roadmap by joining through milestones and initiatives
	 */
	async listDependencies(roadmapId: string): Promise<RoadmapDependency[]> {
		// Get all milestone IDs for this roadmap
		const milestones = await this.db
			.selectFrom("milestones")
			.select("id")
			.where("roadmap_id", "=", roadmapId)
			.execute();

		const milestoneIds = milestones.map((m) => m.id);

		// Get all initiative IDs for this roadmap
		const initiatives = await this.db
			.selectFrom("initiatives")
			.select("id")
			.where("roadmap_id", "=", roadmapId)
			.execute();

		const initiativeIds = initiatives.map((i) => i.id);

		const allNodeIds = [...milestoneIds, ...initiativeIds];
		if (allNodeIds.length === 0) {
			return [];
		}

		// Find dependencies where either source or target is in this roadmap
		const rows = await this.db
			.selectFrom("dependencies")
			.selectAll()
			.where((eb) =>
				eb.or([
					eb("source_id", "in", allNodeIds),
					eb("target_id", "in", allNodeIds),
				]),
			)
			.execute();

		return rows.map((row) => this.toDependency(row));
	}

	/**
	 * Delete a dependency by ID
	 */
	async deleteDependency(id: string): Promise<void> {
		await this.db.deleteFrom("dependencies").where("id", "=", id).execute();
	}

	// ===========================================================================
	// Composite Queries
	// ===========================================================================

	/**
	 * Get a roadmap with all associated details: milestones, initiatives,
	 * vision document, and dependencies.
	 */
	async getRoadmapWithDetails(id: string): Promise<RoadmapWithDetails | null> {
		const roadmap = await this.getRoadmap(id);
		if (!roadmap) {
			return null;
		}

		const [milestones, initiatives, visionDocument, dependencies] =
			await Promise.all([
				this.listMilestones(id),
				this.listInitiativesByRoadmap(id),
				this.getVisionDocument(id),
				this.listDependencies(id),
			]);

		return {
			roadmap,
			milestones,
			initiatives,
			visionDocument,
			dependencies,
		};
	}
}
