/**
 * Repository pattern base types
 *
 * Provides the foundation for all repository classes, ensuring consistent
 * database access patterns across the application.
 */

import type { Kysely } from "kysely";
import type { ProjectDatabase } from "@/backend/db/project";

// =============================================================================
// Core Types
// =============================================================================

/**
 * Type alias for the project database connection
 */
export type ProjectDb = Kysely<ProjectDatabase>;

/**
 * Base interface for all repositories
 */
export interface Repository {
	readonly db: ProjectDb;
}

// =============================================================================
// Repository Factory (uses concrete classes)
// =============================================================================

import type { AnalyticsRepository } from "./AnalyticsRepository";
import type { ArtifactRepository } from "./ArtifactRepository";
import type { ChannelRepository } from "./ChannelRepository";
import type { ConversationRepository } from "./ConversationRepository";
import type { CostRecordRepository } from "./CostRecordRepository";
import type { PulseRepository } from "./PulseRepository";
import type { RoadmapRepository } from "./RoadmapRepository";
import type { SessionRepository } from "./SessionRepository";
import type { WorkflowRepository } from "./WorkflowRepository";

/**
 * Factory that provides access to all repositories with a shared db instance
 */
export interface Repositories {
	analytics: AnalyticsRepository;
	workflows: WorkflowRepository;
	channels: ChannelRepository;
	sessions: SessionRepository;
	artifacts: ArtifactRepository;
	conversations: ConversationRepository;
	costRecords: CostRecordRepository;
	pulses: PulseRepository;
	roadmaps: RoadmapRepository;
}
