/**
 * SessionManager - Tracks concurrent agent sessions
 *
 * Manages the lifecycle of active sessions across channels and workflows.
 * Supports multiple concurrent sessions (e.g., user chatting in a channel
 * while a workflow executes in the background).
 */

import type { Kysely } from "kysely";
import type { ProjectDatabase } from "@/backend/db/project";
import { broadcast } from "@/backend/ws";
import {
	createSessionCompletedEvent,
	createSessionErrorEvent,
	createSessionStartedEvent,
} from "@/shared/schemas/events";
import type { ActiveSession, SessionContext, SessionStatus } from "./types";

// =============================================================================
// SessionManager
// =============================================================================

export class SessionManager {
	/** Active sessions indexed by session ID */
	private sessions = new Map<string, ActiveSession>();

	/** Index of sessions by context (contextType:contextId -> sessionId) */
	private contextIndex = new Map<string, string>();

	constructor(private db: Kysely<ProjectDatabase>) {}

	// ===========================================================================
	// Session Lifecycle
	// ===========================================================================

	/**
	 * Start a new session for a given context
	 */
	async startSession(context: SessionContext): Promise<ActiveSession> {
		const now = Date.now();
		const sessionId = generateSessionId();

		// Check if there's already an active session for this context
		const existingSessionId = this.contextIndex.get(
			this.contextKey(context.contextType, context.contextId),
		);
		if (existingSessionId) {
			const existing = this.sessions.get(existingSessionId);
			if (existing && existing.status === "active") {
				// Stop the existing session first
				await this.stopSession(existingSessionId);
			}
		}

		const session: ActiveSession = {
			id: sessionId,
			contextType: context.contextType,
			contextId: context.contextId,
			agentRole: context.agentRole,
			status: "active",
			abortController: new AbortController(),
			createdAt: now,
		};

		// Persist to database
		await this.db
			.insertInto("sessions")
			.values({
				id: sessionId,
				context_type: context.contextType,
				context_id: context.contextId,
				agent_role: context.agentRole,
				status: "active",
				created_at: now,
				updated_at: now,
			})
			.execute();

		// Track in memory
		this.sessions.set(sessionId, session);
		this.contextIndex.set(
			this.contextKey(context.contextType, context.contextId),
			sessionId,
		);

		// Broadcast event
		broadcast(
			createSessionStartedEvent({
				sessionId,
				contextType: context.contextType,
				contextId: context.contextId,
				agentRole: context.agentRole,
			}),
		);

		return session;
	}

	/**
	 * Stop a session (complete or abort)
	 */
	async stopSession(
		sessionId: string,
		status: "completed" | "error" = "completed",
		error?: string,
	): Promise<void> {
		const session = this.sessions.get(sessionId);
		if (!session) {
			return;
		}

		const now = Date.now();

		// Abort any in-flight operations
		session.abortController.abort();
		session.status = status;

		// Update database
		await this.db
			.updateTable("sessions")
			.set({
				status,
				updated_at: now,
			})
			.where("id", "=", sessionId)
			.execute();

		// Remove from indices
		this.sessions.delete(sessionId);
		this.contextIndex.delete(
			this.contextKey(session.contextType, session.contextId),
		);

		// Broadcast event
		if (status === "completed") {
			broadcast(createSessionCompletedEvent({ sessionId }));
		} else {
			broadcast(
				createSessionErrorEvent({
					sessionId,
					error: error ?? "Session terminated with error",
				}),
			);
		}
	}

	/**
	 * Mark a session as errored
	 */
	async errorSession(sessionId: string, error: string): Promise<void> {
		await this.stopSession(sessionId, "error", error);
	}

	// ===========================================================================
	// Session Queries
	// ===========================================================================

	/**
	 * Get a session by ID
	 */
	getSession(sessionId: string): ActiveSession | undefined {
		return this.sessions.get(sessionId);
	}

	/**
	 * Get the active session for a context (if any)
	 */
	getSessionByContext(
		contextType: string,
		contextId: string,
	): ActiveSession | undefined {
		const sessionId = this.contextIndex.get(
			this.contextKey(contextType, contextId),
		);
		if (!sessionId) {
			return undefined;
		}
		return this.sessions.get(sessionId);
	}

	/**
	 * Check if a context has an active session
	 */
	hasActiveSession(contextType: string, contextId: string): boolean {
		const session = this.getSessionByContext(contextType, contextId);
		return session?.status === "active";
	}

	/**
	 * Get all active sessions
	 */
	getActiveSessions(): ActiveSession[] {
		return Array.from(this.sessions.values()).filter(
			(s) => s.status === "active",
		);
	}

	/**
	 * Get the count of active sessions
	 */
	getActiveSessionCount(): number {
		return this.getActiveSessions().length;
	}

	// ===========================================================================
	// Helpers
	// ===========================================================================

	private contextKey(contextType: string, contextId: string): string {
		return `${contextType}:${contextId}`;
	}
}

// =============================================================================
// Helpers
// =============================================================================

function generateSessionId(): string {
	return `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// =============================================================================
// Singleton Instance
// =============================================================================

let sessionManagerInstance: SessionManager | null = null;

/**
 * Get the singleton SessionManager instance
 * Must be initialized with initSessionManager first
 */
export function getSessionManager(): SessionManager {
	if (!sessionManagerInstance) {
		throw new Error(
			"SessionManager not initialized. Call initSessionManager first.",
		);
	}
	return sessionManagerInstance;
}

/**
 * Initialize the singleton SessionManager instance
 */
export function initSessionManager(
	db: Kysely<ProjectDatabase>,
): SessionManager {
	sessionManagerInstance = new SessionManager(db);
	return sessionManagerInstance;
}
