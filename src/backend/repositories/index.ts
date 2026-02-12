/**
 * Repository layer - Centralized data access
 *
 * All database queries should go through repositories to ensure:
 * - Consistent domain object mapping
 * - Single source of truth for queries
 * - Easier testing via repository mocking
 */

import type { Kysely } from "kysely";
import type { ProjectDatabase } from "@/backend/db/project";
import { AnalyticsRepository } from "./AnalyticsRepository";
import { ArtifactRepository } from "./ArtifactRepository";
import { ChannelRepository } from "./ChannelRepository";
import { ConversationRepository } from "./ConversationRepository";
import { CostRecordRepository } from "./CostRecordRepository";
import { PulseRepository } from "./PulseRepository";
import { RoadmapRepository } from "./RoadmapRepository";
import { SessionRepository } from "./SessionRepository";
import type { Repositories } from "./types";
import { WorkflowRepository } from "./WorkflowRepository";

// Re-export repository classes
export { AnalyticsRepository } from "./AnalyticsRepository";
export { ArtifactRepository } from "./ArtifactRepository";
export { ChannelRepository } from "./ChannelRepository";
export { ConversationRepository } from "./ConversationRepository";
export { CostRecordRepository } from "./CostRecordRepository";
export type { PreflightSetup, Pulse } from "./PulseRepository";
export { PulseRepository } from "./PulseRepository";
export { RoadmapRepository } from "./RoadmapRepository";
export { SessionRepository } from "./SessionRepository";
// Re-export types
export type { ProjectDb, Repositories } from "./types";
export { WorkflowRepository } from "./WorkflowRepository";

// =============================================================================
// Singleton Instance
// =============================================================================

let repositoriesInstance: Repositories | null = null;

/**
 * Initialize the repositories with a database connection.
 * Must be called once during application startup.
 */
export function initRepositories(db: Kysely<ProjectDatabase>): Repositories {
	repositoriesInstance = {
		analytics: new AnalyticsRepository(db),
		workflows: new WorkflowRepository(db),
		channels: new ChannelRepository(db),
		sessions: new SessionRepository(db),
		artifacts: new ArtifactRepository(db),
		conversations: new ConversationRepository(db),
		costRecords: new CostRecordRepository(db),
		pulses: new PulseRepository(db),
		roadmaps: new RoadmapRepository(db),
	};
	return repositoriesInstance;
}

/**
 * Get the singleton repositories instance.
 * Throws if not initialized.
 */
export function getRepositories(): Repositories {
	if (!repositoriesInstance) {
		throw new Error(
			"Repositories not initialized. Call initRepositories first.",
		);
	}
	return repositoriesInstance;
}
