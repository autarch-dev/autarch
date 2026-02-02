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
	/** Optional pulse ID to link execution sessions to their associated pulse */
	pulseId?: string;
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
				pulse_id: data.pulseId ?? null,
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

	// ===========================================================================
	// Delete Operations
	// ===========================================================================

	/**
	 * Delete a session and all its associated data (turns, messages, tools, etc.)
	 */
	async deleteSession(sessionId: string): Promise<void> {
		// Get all turn IDs for this session
		const turns = await this.db
			.selectFrom("turns")
			.select("id")
			.where("session_id", "=", sessionId)
			.execute();

		const turnIds = turns.map((t) => t.id);

		if (turnIds.length > 0) {
			// Delete turn-related data
			await this.db
				.deleteFrom("turn_messages")
				.where("turn_id", "in", turnIds)
				.execute();
			await this.db
				.deleteFrom("turn_tools")
				.where("turn_id", "in", turnIds)
				.execute();
			await this.db
				.deleteFrom("turn_thoughts")
				.where("turn_id", "in", turnIds)
				.execute();
			await this.db
				.deleteFrom("questions")
				.where("turn_id", "in", turnIds)
				.execute();

			// Delete turns
			await this.db
				.deleteFrom("turns")
				.where("session_id", "=", sessionId)
				.execute();
		}

		// Delete session notes
		await this.db
			.deleteFrom("session_notes")
			.where("session_id", "=", sessionId)
			.execute();

		// Delete the session itself
		await this.db.deleteFrom("sessions").where("id", "=", sessionId).execute();
	}

	/**
	 * Delete all sessions for a context with specific agent roles
	 */
	async deleteByContextAndRoles(
		contextType: SessionContextType,
		contextId: string,
		roles: string[],
	): Promise<number> {
		// Get sessions matching criteria
		const sessions = await this.db
			.selectFrom("sessions")
			.select("id")
			.where("context_type", "=", contextType)
			.where("context_id", "=", contextId)
			.where("agent_role", "in", roles)
			.execute();

		// Delete each session with its data
		for (const session of sessions) {
			await this.deleteSession(session.id);
		}

		return sessions.length;
	}
}
