/**
 * SessionManager - Tracks concurrent agent sessions
 *
 * Manages the lifecycle of active sessions across channels and workflows.
 * Supports multiple concurrent sessions (e.g., user chatting in a channel
 * while a workflow executes in the background).
 *
 * Maintains in-memory state (AbortControllers, session tracking) while
 * delegating all persistence to SessionRepository.
 */

import { log } from "@/backend/logger";
import type { SessionRepository } from "@/backend/repositories";
import { broadcast } from "@/backend/ws";
import {
	createSessionCompletedEvent,
	createSessionErrorEvent,
	createSessionStartedEvent,
} from "@/shared/schemas/events";
import type { ActiveSession, SessionContext } from "./types";

// =============================================================================
// SessionManager
// =============================================================================

export class SessionManager {
	/** Active sessions indexed by session ID */
	private sessions = new Map<string, ActiveSession>();

	/** Index of sessions by context (contextType:contextId -> sessionId) */
	private contextIndex = new Map<string, string>();

	constructor(private sessionRepo: SessionRepository) {}

	// ===========================================================================
	// Session Lifecycle
	// ===========================================================================

	/**
	 * Start a new session for a given context
	 */
	async startSession(context: SessionContext): Promise<ActiveSession> {
		// Check if there's already an active session for this context
		const existingSessionId = this.contextIndex.get(
			this.contextKey(context.contextType, context.contextId),
		);
		if (existingSessionId) {
			const existing = this.sessions.get(existingSessionId);
			if (existing && existing.status === "active") {
				// Stop the existing session first
				log.session.debug(
					`Stopping existing session ${existingSessionId} for ${context.contextType}:${context.contextId}`,
				);
				await this.stopSession(existingSessionId);
			}
		}

		// Create session in database via repository
		const dbSession = await this.sessionRepo.create({
			contextType: context.contextType,
			contextId: context.contextId,
			agentRole: context.agentRole,
		});

		// Build runtime session with AbortController
		const session: ActiveSession = {
			id: dbSession.id,
			contextType: context.contextType,
			contextId: context.contextId,
			agentRole: context.agentRole,
			status: "active",
			abortController: new AbortController(),
			createdAt: dbSession.createdAt,
		};

		// Track in memory
		this.sessions.set(session.id, session);
		this.contextIndex.set(
			this.contextKey(context.contextType, context.contextId),
			session.id,
		);

		// Broadcast event
		broadcast(
			createSessionStartedEvent({
				sessionId: session.id,
				contextType: context.contextType,
				contextId: context.contextId,
				agentRole: context.agentRole,
			}),
		);

		log.session.info(
			`Started session ${session.id} [${context.agentRole}] for ${context.contextType}:${context.contextId}`,
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
			log.session.debug(`Session ${sessionId} not found (already stopped?)`);
			return;
		}

		// Abort any in-flight operations
		session.abortController.abort();
		session.status = status;

		// Update database via repository
		await this.sessionRepo.updateStatus(sessionId, status);

		// Remove from indices
		this.sessions.delete(sessionId);
		this.contextIndex.delete(
			this.contextKey(session.contextType, session.contextId),
		);

		// Broadcast event
		if (status === "completed") {
			broadcast(createSessionCompletedEvent({ sessionId }));
			log.session.success(`Session ${sessionId} completed`);
		} else {
			broadcast(
				createSessionErrorEvent({
					sessionId,
					error: error ?? "Session terminated with error",
				}),
			);
			log.session.error(`Session ${sessionId} failed: ${error}`);
		}
	}

	/**
	 * Mark a session as errored
	 */
	async errorSession(sessionId: string, error: string): Promise<void> {
		log.session.warn(`Marking session ${sessionId} as errored: ${error}`);
		await this.stopSession(sessionId, "error", error);
	}

	// ===========================================================================
	// Session Queries
	// ===========================================================================

	/**
	 * Get a session by ID, restoring from DB if not in memory.
	 * This allows sessions to survive server restarts.
	 */
	async getOrRestoreSession(
		sessionId: string,
	): Promise<ActiveSession | undefined> {
		// Check in-memory first
		const existing = this.sessions.get(sessionId);
		if (existing) {
			return existing;
		}

		// Try to restore from database via repository
		const dbSession = await this.sessionRepo.getActiveById(sessionId);

		if (!dbSession) {
			return undefined;
		}

		// Rehydrate into memory with a fresh AbortController
		const session: ActiveSession = {
			id: dbSession.id,
			contextType: dbSession.contextType as ActiveSession["contextType"],
			contextId: dbSession.contextId,
			agentRole: dbSession.agentRole as ActiveSession["agentRole"],
			status: "active",
			abortController: new AbortController(),
			createdAt: dbSession.createdAt,
		};

		this.sessions.set(sessionId, session);
		this.contextIndex.set(
			this.contextKey(session.contextType, session.contextId),
			sessionId,
		);

		log.session.info(`Restored session ${sessionId} from database`);
		return session;
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
	sessionRepo: SessionRepository,
): SessionManager {
	sessionManagerInstance = new SessionManager(sessionRepo);
	return sessionManagerInstance;
}
