/**
 * SessionRepository - Data access for sessions
 *
 * Handles persistence for agent sessions. The SessionManager maintains
 * in-memory state (AbortControllers, etc.) while delegating all database
 * operations to this repository.
 */

import type { SessionsTable } from "@/backend/db/project/types";
import { ids } from "@/backend/utils";
import type {
	SessionContextType,
	SessionStatus,
} from "@/shared/schemas/session";
import type { ProjectDb, Repository } from "./types";

// =============================================================================
// Types
// =============================================================================

/**
 * Session data as stored in the database (without runtime state)
 */
export interface SessionRow {
	id: string;
	contextType: SessionContextType;
	contextId: string;
	agentRole: string;
	status: SessionStatus;
	createdAt: number;
	updatedAt: number;
}

export interface CreateSessionData {
	contextType: SessionContextType;
	contextId: string;
	agentRole: string;
}

// =============================================================================
// Repository
// =============================================================================

export class SessionRepository implements Repository {
	constructor(readonly db: ProjectDb) {}

	// ===========================================================================
	// Domain Mapping
	// ===========================================================================

	/**
	 * Convert a database row to a SessionRow object.
	 * Single source of truth for this mapping.
	 */
	private toSessionRow(row: SessionsTable): SessionRow {
		return {
			id: row.id,
			contextType: row.context_type,
			contextId: row.context_id,
			agentRole: row.agent_role,
			status: row.status,
			createdAt: row.created_at,
			updatedAt: row.updated_at,
		};
	}

	// ===========================================================================
	// Read Operations
	// ===========================================================================

	/**
	 * Get a session by ID
	 */
	async getById(id: string): Promise<SessionRow | null> {
		const row = await this.db
			.selectFrom("sessions")
			.selectAll()
			.where("id", "=", id)
			.executeTakeFirst();

		return row ? this.toSessionRow(row) : null;
	}

	/**
	 * Get an active session by ID (only returns if status is "active")
	 */
	async getActiveById(id: string): Promise<SessionRow | null> {
		const row = await this.db
			.selectFrom("sessions")
			.selectAll()
			.where("id", "=", id)
			.where("status", "=", "active")
			.executeTakeFirst();

		return row ? this.toSessionRow(row) : null;
	}

	/**
	 * Get all sessions for a context (channel or workflow)
	 */
	async getByContext(
		contextType: SessionContextType,
		contextId: string,
	): Promise<SessionRow[]> {
		const rows = await this.db
			.selectFrom("sessions")
			.selectAll()
			.where("context_type", "=", contextType)
			.where("context_id", "=", contextId)
			.orderBy("created_at", "asc")
			.execute();

		return rows.map((row) => this.toSessionRow(row));
	}

	/**
	 * Get the active session for a context (if any)
	 */
	async getActiveByContext(
		contextType: SessionContextType,
		contextId: string,
	): Promise<SessionRow | null> {
		const row = await this.db
			.selectFrom("sessions")
			.selectAll()
			.where("context_type", "=", contextType)
			.where("context_id", "=", contextId)
			.where("status", "=", "active")
			.executeTakeFirst();

		return row ? this.toSessionRow(row) : null;
	}

	// ===========================================================================
	// Write Operations
	// ===========================================================================

	/**
	 * Create a new session
	 */
	async create(data: CreateSessionData): Promise<SessionRow> {
		const now = Date.now();
		const sessionId = ids.session();

		await this.db
			.insertInto("sessions")
			.values({
				id: sessionId,
				context_type: data.contextType,
				context_id: data.contextId,
				agent_role: data.agentRole,
				status: "active",
				created_at: now,
				updated_at: now,
			})
			.execute();

		const session = await this.getById(sessionId);
		if (!session) {
			throw new Error(`Failed to create session: ${sessionId}`);
		}
		return session;
	}

	/**
	 * Update session status
	 */
	async updateStatus(id: string, status: SessionStatus): Promise<void> {
		await this.db
			.updateTable("sessions")
			.set({
				status,
				updated_at: Date.now(),
			})
			.where("id", "=", id)
			.execute();
	}
}
