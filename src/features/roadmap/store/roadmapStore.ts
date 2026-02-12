/**
 * Roadmap Store
 *
 * Zustand store for managing roadmaps and their conversations.
 * Handles roadmap CRUD, message history, and real-time streaming updates.
 */

import { create } from "zustand";
import type { ChannelMessage, MessageQuestion } from "@/shared/schemas/channel";
import type {
	PersonaRoadmapSubmittedPayload,
	QuestionsAnsweredPayload,
	QuestionsAskedPayload,
	QuestionsSubmittedPayload,
	RoadmapCreatedPayload,
	RoadmapDeletedPayload,
	RoadmapUpdatedPayload,
	SessionStartedPayload,
	TurnCompletedPayload,
	TurnMessageDeltaPayload,
	TurnSegmentCompletePayload,
	TurnStartedPayload,
	TurnThoughtDeltaPayload,
	TurnToolCompletedPayload,
	TurnToolStartedPayload,
	WebSocketEvent,
} from "@/shared/schemas/events";
import type {
	Initiative,
	Milestone,
	Roadmap,
	RoadmapDependency,
	VisionDocument,
} from "@/shared/schemas/roadmap";

// =============================================================================
// Types
// =============================================================================

/** A text segment within a streaming message */
export interface StreamingSegment {
	index: number;
	content: string;
	isComplete: boolean;
}

/**
 * Question in a streaming message.
 * Uses the same type as MessageQuestion from the channel schema.
 */
export type StreamingQuestion = MessageQuestion;

/** Streaming state for an active message */
export interface StreamingMessage {
	turnId: string;
	role: "user" | "assistant";
	/** Text segments - split by tool calls */
	segments: StreamingSegment[];
	/** Index of the currently streaming segment */
	activeSegmentIndex: number;
	thought: string;
	tools: {
		id: string;
		/** Index for interleaving - tool appears after segment with this index */
		index: number;
		name: string;
		input: unknown;
		output?: unknown;
		status: "running" | "completed" | "error";
	}[];
	/** Questions asked by the agent */
	questions: StreamingQuestion[];
	/** User comment/feedback provided when submitting question answers */
	questionsComment?: string;
	isComplete: boolean;
	/** Agent role from session (e.g., roadmap_planning) */
	agentRole?: string;
}

/** Persona name literals for the 4 discovery personas */
export const PERSONA_NAMES = [
	"visionary",
	"iterative",
	"tech_lead",
	"pathfinder",
] as const;
export type PersonaName = (typeof PERSONA_NAMES)[number];

/** Tab name including synthesis */
export type PersonaTab = PersonaName | "synthesis";

/** Tracking state for a single persona session */
export interface PersonaSessionState {
	persona: string;
	sessionId: string;
	status: "pending" | "running" | "completed" | "failed";
	roadmapId?: string;
	roadmapData?: unknown;
}

/** Per-session conversation state */
export interface RoadmapConversationState {
	sessionId?: string;
	sessionStatus?: "active" | "completed" | "error";
	messages: ChannelMessage[];
	streamingMessage?: StreamingMessage;
	isLoading: boolean;
	error?: string;
	/** Persona name if this is a persona conversation */
	persona?: string;
	/** Roadmap ID this conversation belongs to */
	roadmapId?: string;
}

/** Roadmap details (milestones, initiatives, vision, dependencies) */
export interface RoadmapDetails {
	milestones: Milestone[];
	initiatives: Initiative[];
	vision?: VisionDocument;
	dependencies: RoadmapDependency[];
}

// =============================================================================
// Store State
// =============================================================================

interface RoadmapState {
	// Roadmap list
	roadmaps: Roadmap[];
	roadmapsLoading: boolean;
	roadmapsError: string | null;

	// Selected roadmap
	selectedRoadmapId: string | null;

	// Per-roadmap details
	roadmapDetails: Map<string, RoadmapDetails>;

	// Per-session conversation state (keyed by sessionId)
	conversations: Map<string, RoadmapConversationState>;

	// Persona session tracking (keyed by sessionId)
	personaSessions: Map<string, PersonaSessionState>;
	synthesisSessionId: string | null;
	activePersonaTab: PersonaTab;

	// Actions - Roadmap CRUD
	fetchRoadmaps: () => Promise<void>;
	createRoadmap: (
		title: string,
		mode: "ai" | "blank",
		prompt?: string,
	) => Promise<Roadmap>;
	selectRoadmap: (roadmapId: string | null) => void;
	updateRoadmap: (
		roadmapId: string,
		data: Partial<Pick<Roadmap, "title" | "description" | "status">>,
	) => Promise<void>;
	deleteRoadmap: (roadmapId: string) => Promise<void>;

	// Actions - Details
	fetchRoadmapDetails: (roadmapId: string) => Promise<void>;

	// Actions - Milestones
	createMilestone: (
		roadmapId: string,
		data: {
			title: string;
			description?: string;
		},
	) => Promise<Milestone>;
	updateMilestone: (
		roadmapId: string,
		milestoneId: string,
		data: Partial<Pick<Milestone, "title" | "description" | "sortOrder">>,
	) => Promise<void>;
	deleteMilestone: (roadmapId: string, milestoneId: string) => Promise<void>;

	// Actions - Initiatives
	createInitiative: (
		roadmapId: string,
		milestoneId: string,
		data: {
			title: string;
			description?: string;
			priority?: string;
			size?: Initiative["size"];
		},
	) => Promise<Initiative>;
	updateInitiative: (
		roadmapId: string,
		initiativeId: string,
		data: Partial<
			Pick<
				Initiative,
				| "title"
				| "description"
				| "status"
				| "priority"
				| "progress"
				| "size"
				| "milestoneId"
				| "sortOrder"
			>
		> & { workflowId?: string | null },
	) => Promise<void>;
	deleteInitiative: (roadmapId: string, initiativeId: string) => Promise<void>;

	// Actions - Vision
	updateVision: (roadmapId: string, content: string) => Promise<void>;

	// Actions - Dependencies
	createDependency: (
		roadmapId: string,
		data: Pick<
			RoadmapDependency,
			"sourceType" | "sourceId" | "targetType" | "targetId"
		>,
	) => Promise<RoadmapDependency>;
	deleteDependency: (roadmapId: string, dependencyId: string) => Promise<void>;

	// Actions - Conversation
	fetchHistory: (roadmapId: string) => Promise<void>;
	sendMessage: (roadmapId: string, content: string) => Promise<void>;
	fetchPersonaSessions: (roadmapId: string) => Promise<void>;

	// Actions - WebSocket event handling
	handleWebSocketEvent: (event: WebSocketEvent) => void;

	// Getters
	getRoadmap: (roadmapId: string) => Roadmap | undefined;
	getRoadmapDetails: (roadmapId: string) => RoadmapDetails | undefined;
	getConversation: (roadmapId: string) => RoadmapConversationState | undefined;
	getConversationBySession: (
		sessionId: string,
	) => RoadmapConversationState | undefined;
	getSelectedConversation: () => RoadmapConversationState | undefined;
}

// =============================================================================
// Store
// =============================================================================

export const useRoadmapStore = create<RoadmapState>((set, get) => ({
	// Initial state
	roadmaps: [],
	roadmapsLoading: false,
	roadmapsError: null,
	selectedRoadmapId: null,
	roadmapDetails: new Map(),
	conversations: new Map(),
	personaSessions: new Map(),
	synthesisSessionId: null,
	activePersonaTab: "visionary" as PersonaTab,

	// ===========================================================================
	// Roadmap CRUD
	// ===========================================================================

	fetchRoadmaps: async () => {
		set({ roadmapsLoading: true, roadmapsError: null });
		try {
			const response = await fetch("/api/roadmaps");
			if (!response.ok) {
				throw new Error("Failed to fetch roadmaps");
			}
			const roadmaps: Roadmap[] = await response.json();
			set({ roadmaps, roadmapsLoading: false });
		} catch (error) {
			set({
				roadmapsError: error instanceof Error ? error.message : "Unknown error",
				roadmapsLoading: false,
			});
		}
	},

	createRoadmap: async (
		title: string,
		mode: "ai" | "blank",
		prompt?: string,
	) => {
		const response = await fetch("/api/roadmaps", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ title, mode, prompt }),
		});

		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error ?? "Failed to create roadmap");
		}

		const roadmap: Roadmap = await response.json();

		// Don't add optimistically - the WebSocket roadmap:created event handles this.
		// But we DO need to ensure the roadmap is in state before returning
		// so the caller can select it.
		set((state) => {
			if (state.roadmaps.some((r) => r.id === roadmap.id)) {
				return {}; // Already added by WebSocket event
			}
			return { roadmaps: [...state.roadmaps, roadmap] };
		});

		return roadmap;
	},

	selectRoadmap: (roadmapId: string | null) => {
		set({ selectedRoadmapId: roadmapId });
	},

	updateRoadmap: async (roadmapId, data) => {
		const response = await fetch(`/api/roadmaps/${roadmapId}`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(data),
		});

		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error ?? "Failed to update roadmap");
		}

		const updated: Roadmap = await response.json();
		set((state) => ({
			roadmaps: state.roadmaps.map((r) => (r.id === roadmapId ? updated : r)),
		}));
	},

	deleteRoadmap: async (roadmapId) => {
		const response = await fetch(`/api/roadmaps/${roadmapId}`, {
			method: "DELETE",
		});

		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error ?? "Failed to delete roadmap");
		}

		set((state) => {
			const roadmaps = state.roadmaps.filter((r) => r.id !== roadmapId);
			const roadmapDetails = new Map(state.roadmapDetails);
			roadmapDetails.delete(roadmapId);
			// Remove all conversations belonging to this roadmap
			const conversations = new Map(state.conversations);
			for (const [sessionId, conv] of conversations) {
				if (conv.roadmapId === roadmapId) {
					conversations.delete(sessionId);
				}
			}
			// Also clean up persona sessions for this roadmap
			const personaSessions = new Map(state.personaSessions);
			for (const [sessionId, _ps] of personaSessions) {
				if (_ps.roadmapId === roadmapId) {
					personaSessions.delete(sessionId);
				}
			}
			// Reset persona UI state if the deleted roadmap is the active one
			const synthesisConv = state.synthesisSessionId
				? state.conversations.get(state.synthesisSessionId)
				: undefined;
			const resetPersonaState =
				synthesisConv?.roadmapId === roadmapId ||
				[...state.personaSessions.values()].some(
					(ps) => ps.roadmapId === roadmapId,
				);
			return {
				roadmaps,
				roadmapDetails,
				conversations,
				personaSessions,
				...(resetPersonaState
					? {
							synthesisSessionId: null,
							activePersonaTab: "visionary" as PersonaTab,
						}
					: {}),
			};
		});
	},

	// ===========================================================================
	// Details
	// ===========================================================================

	fetchRoadmapDetails: async (roadmapId) => {
		const response = await fetch(`/api/roadmaps/${roadmapId}`);
		if (!response.ok) {
			throw new Error("Failed to fetch roadmap details");
		}

		const data = await response.json();

		set((state) => {
			// Update roadmap in list
			const roadmaps = state.roadmaps.map((r) =>
				r.id === roadmapId && data.roadmap ? data.roadmap : r,
			);

			const roadmapDetails = new Map(state.roadmapDetails);
			roadmapDetails.set(roadmapId, {
				milestones: data.milestones ?? [],
				initiatives: data.initiatives ?? [],
				vision: data.visionDocument,
				dependencies: data.dependencies ?? [],
			});

			return { roadmaps, roadmapDetails };
		});
	},

	// ===========================================================================
	// Milestones
	// ===========================================================================

	createMilestone: async (roadmapId, data) => {
		// Compute sortOrder from existing milestones if not provided
		const existing = get().roadmapDetails.get(roadmapId);
		const sortOrder = existing ? existing.milestones.length : 0;

		const response = await fetch(`/api/roadmaps/${roadmapId}/milestones`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ ...data, sortOrder }),
		});

		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error ?? "Failed to create milestone");
		}

		const milestone: Milestone = await response.json();

		set((state) => {
			const roadmapDetails = new Map(state.roadmapDetails);
			const existing = roadmapDetails.get(roadmapId);
			if (existing) {
				roadmapDetails.set(roadmapId, {
					...existing,
					milestones: [...existing.milestones, milestone],
				});
			}
			return { roadmapDetails };
		});

		return milestone;
	},

	updateMilestone: async (roadmapId, milestoneId, data) => {
		const response = await fetch(
			`/api/roadmaps/${roadmapId}/milestones/${milestoneId}`,
			{
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(data),
			},
		);

		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error ?? "Failed to update milestone");
		}

		const updated: Milestone = await response.json();

		set((state) => {
			const roadmapDetails = new Map(state.roadmapDetails);
			const existing = roadmapDetails.get(roadmapId);
			if (existing) {
				roadmapDetails.set(roadmapId, {
					...existing,
					milestones: existing.milestones.map((m) =>
						m.id === milestoneId ? updated : m,
					),
				});
			}
			return { roadmapDetails };
		});
	},

	deleteMilestone: async (roadmapId, milestoneId) => {
		const response = await fetch(
			`/api/roadmaps/${roadmapId}/milestones/${milestoneId}`,
			{ method: "DELETE" },
		);

		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error ?? "Failed to delete milestone");
		}

		set((state) => {
			const roadmapDetails = new Map(state.roadmapDetails);
			const existing = roadmapDetails.get(roadmapId);
			if (existing) {
				// Collect IDs of initiatives belonging to this milestone
				const orphanedInitiativeIds = new Set(
					existing.initiatives
						.filter((i) => i.milestoneId === milestoneId)
						.map((i) => i.id),
				);

				// Remove dependencies referencing the milestone or its child initiatives
				const isOrphaned = (type: string, id: string) =>
					(type === "milestone" && id === milestoneId) ||
					(type === "initiative" && orphanedInitiativeIds.has(id));

				roadmapDetails.set(roadmapId, {
					...existing,
					milestones: existing.milestones.filter((m) => m.id !== milestoneId),
					initiatives: existing.initiatives.filter(
						(i) => i.milestoneId !== milestoneId,
					),
					dependencies: existing.dependencies.filter(
						(d) =>
							!isOrphaned(d.sourceType, d.sourceId) &&
							!isOrphaned(d.targetType, d.targetId),
					),
				});
			}
			return { roadmapDetails };
		});
	},

	// ===========================================================================
	// Initiatives
	// ===========================================================================

	createInitiative: async (roadmapId, milestoneId, data) => {
		// Compute sortOrder from existing initiatives in this milestone
		const existing = get().roadmapDetails.get(roadmapId);
		const sortOrder = existing
			? existing.initiatives.filter((i) => i.milestoneId === milestoneId).length
			: 0;

		const response = await fetch(`/api/roadmaps/${roadmapId}/initiatives`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				...data,
				milestoneId,
				sortOrder,
			}),
		});

		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error ?? "Failed to create initiative");
		}

		const initiative: Initiative = await response.json();

		set((state) => {
			const roadmapDetails = new Map(state.roadmapDetails);
			const existing = roadmapDetails.get(roadmapId);
			if (existing) {
				roadmapDetails.set(roadmapId, {
					...existing,
					initiatives: [...existing.initiatives, initiative],
				});
			}
			return { roadmapDetails };
		});

		return initiative;
	},

	updateInitiative: async (roadmapId, initiativeId, data) => {
		const response = await fetch(
			`/api/roadmaps/${roadmapId}/initiatives/${initiativeId}`,
			{
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(data),
			},
		);

		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error ?? "Failed to update initiative");
		}

		const updated: Initiative = await response.json();

		set((state) => {
			const roadmapDetails = new Map(state.roadmapDetails);
			const existing = roadmapDetails.get(roadmapId);
			if (existing) {
				roadmapDetails.set(roadmapId, {
					...existing,
					initiatives: existing.initiatives.map((i) =>
						i.id === initiativeId ? updated : i,
					),
				});
			}
			return { roadmapDetails };
		});
	},

	deleteInitiative: async (roadmapId, initiativeId) => {
		const response = await fetch(
			`/api/roadmaps/${roadmapId}/initiatives/${initiativeId}`,
			{ method: "DELETE" },
		);

		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error ?? "Failed to delete initiative");
		}

		set((state) => {
			const roadmapDetails = new Map(state.roadmapDetails);
			const existing = roadmapDetails.get(roadmapId);
			if (existing) {
				roadmapDetails.set(roadmapId, {
					...existing,
					initiatives: existing.initiatives.filter(
						(i) => i.id !== initiativeId,
					),
				});
			}
			return { roadmapDetails };
		});
	},

	// ===========================================================================
	// Vision
	// ===========================================================================

	updateVision: async (roadmapId, content) => {
		const response = await fetch(`/api/roadmaps/${roadmapId}/vision`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ content }),
		});

		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error ?? "Failed to update vision");
		}

		const vision: VisionDocument = await response.json();

		set((state) => {
			const roadmapDetails = new Map(state.roadmapDetails);
			const existing = roadmapDetails.get(roadmapId);
			if (existing) {
				roadmapDetails.set(roadmapId, {
					...existing,
					vision,
				});
			}
			return { roadmapDetails };
		});
	},

	// ===========================================================================
	// Dependencies
	// ===========================================================================

	createDependency: async (roadmapId, data) => {
		const response = await fetch(`/api/roadmaps/${roadmapId}/dependencies`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(data),
		});

		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error ?? "Failed to create dependency");
		}

		const dependency: RoadmapDependency = await response.json();

		set((state) => {
			const roadmapDetails = new Map(state.roadmapDetails);
			const existing = roadmapDetails.get(roadmapId);
			if (existing) {
				roadmapDetails.set(roadmapId, {
					...existing,
					dependencies: [...existing.dependencies, dependency],
				});
			}
			return { roadmapDetails };
		});

		return dependency;
	},

	deleteDependency: async (roadmapId, dependencyId) => {
		const response = await fetch(
			`/api/roadmaps/${roadmapId}/dependencies/${dependencyId}`,
			{ method: "DELETE" },
		);

		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error ?? "Failed to delete dependency");
		}

		set((state) => {
			const roadmapDetails = new Map(state.roadmapDetails);
			const existing = roadmapDetails.get(roadmapId);
			if (existing) {
				roadmapDetails.set(roadmapId, {
					...existing,
					dependencies: existing.dependencies.filter(
						(d) => d.id !== dependencyId,
					),
				});
			}
			return { roadmapDetails };
		});
	},

	// ===========================================================================
	// Conversation Management
	// ===========================================================================

	fetchHistory: async (roadmapId) => {
		// Find existing conversation for this roadmap (may be keyed by sessionId)
		const findExistingSessionId = (): string | undefined => {
			const state = get();
			for (const [sid, conv] of state.conversations) {
				if (conv.roadmapId === roadmapId && !conv.persona) return sid;
			}
			const roadmap = state.roadmaps.find((r) => r.id === roadmapId);
			return roadmap?.currentSessionId ?? undefined;
		};

		const existingSessionId = findExistingSessionId();

		// Mark as loading
		set((state) => {
			const conversations = new Map(state.conversations);
			// Use existing sessionId as key, or a temporary roadmapId key until we get the real sessionId
			const key = existingSessionId ?? `pending_${roadmapId}`;
			const existing = conversations.get(key) ?? {
				messages: [],
				isLoading: true,
				roadmapId,
			};
			conversations.set(key, { ...existing, isLoading: true });
			return { conversations };
		});

		try {
			const response = await fetch(`/api/roadmaps/${roadmapId}/history`);
			if (!response.ok) {
				throw new Error("Failed to fetch history");
			}

			const history = await response.json();

			set((state) => {
				const conversations = new Map(state.conversations);
				// Clean up temporary pending key if it existed
				conversations.delete(`pending_${roadmapId}`);
				// Also clean up any previous sessionId entry for this roadmap
				if (existingSessionId && existingSessionId !== history.sessionId) {
					conversations.delete(existingSessionId);
				}

				const existing = conversations.get(history.sessionId);
				conversations.set(history.sessionId, {
					sessionId: history.sessionId,
					sessionStatus: history.sessionStatus,
					messages: history.messages ?? [],
					isLoading: false,
					roadmapId,
					// Preserve streamingMessage if it exists (race with WebSocket events)
					streamingMessage: existing?.streamingMessage,
				});

				// Update roadmap in list with latest data if provided
				const roadmaps = history.roadmap
					? state.roadmaps.map((r) =>
							r.id === roadmapId ? history.roadmap : r,
						)
					: state.roadmaps;

				return { conversations, roadmaps };
			});
		} catch (error) {
			set((state) => {
				const conversations = new Map(state.conversations);
				const key = existingSessionId ?? `pending_${roadmapId}`;
				const existing = conversations.get(key);
				conversations.set(key, {
					...existing,
					messages: existing?.messages ?? [],
					isLoading: false,
					roadmapId,
					error: error instanceof Error ? error.message : "Unknown error",
				});
				return { conversations };
			});
		}
	},

	sendMessage: async (roadmapId, content) => {
		const state = get();
		const roadmap = state.roadmaps.find((r) => r.id === roadmapId);

		// Find sessionId: search conversations by roadmapId field, then fallback to roadmap.currentSessionId
		let sessionId: string | undefined;
		for (const [sid, conv] of state.conversations) {
			if (conv.roadmapId === roadmapId && !conv.persona) {
				sessionId = sid;
				break;
			}
		}
		if (!sessionId && roadmap?.currentSessionId) {
			sessionId = roadmap.currentSessionId;
		}

		if (!sessionId) {
			throw new Error("No active session for this roadmap");
		}

		// Add user message optimistically
		const userMessage: ChannelMessage = {
			id: `temp_${Date.now()}`,
			turnId: `temp_${Date.now()}`,
			role: "user",
			segments: [{ index: 0, content }],
			timestamp: Date.now(),
		};

		set((state) => {
			const conversations = new Map(state.conversations);
			const existing = conversations.get(sessionId);
			conversations.set(sessionId, {
				...existing,
				messages: [...(existing?.messages ?? []), userMessage],
				isLoading: false,
				sessionId,
				sessionStatus: "active",
				roadmapId,
			});
			return { conversations };
		});

		// Send message to backend
		const response = await fetch(`/api/sessions/${sessionId}/message`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ content }),
		});

		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error ?? "Failed to send message");
		}
	},

	fetchPersonaSessions: async (roadmapId) => {
		try {
			const response = await fetch(
				`/api/roadmaps/${roadmapId}/persona-sessions`,
			);
			if (!response.ok) {
				throw new Error("Failed to fetch persona sessions");
			}

			const data = await response.json();

			set((state) => {
				const personaSessions = new Map(state.personaSessions);
				const conversations = new Map(state.conversations);

				// Populate persona sessions and their conversations
				for (const session of data.personas ?? []) {
					personaSessions.set(session.sessionId, {
						persona: session.persona,
						sessionId: session.sessionId,
						status: session.status,
						roadmapId,
						roadmapData: session.roadmapData,
					});

					if (session.sessionId) {
						conversations.set(session.sessionId, {
							sessionId: session.sessionId,
							sessionStatus:
								session.status === "completed" ? "completed" : "active",
							messages: session.messages ?? [],
							isLoading: false,
							persona: session.persona,
							roadmapId,
						});
					}
				}

				// Populate synthesis session if present
				const synthesis = data.synthesis;
				let synthesisSessionId = state.synthesisSessionId;
				if (synthesis?.sessionId) {
					synthesisSessionId = synthesis.sessionId;
					conversations.set(synthesis.sessionId, {
						sessionId: synthesis.sessionId,
						sessionStatus:
							synthesis.status === "completed" ? "completed" : "active",
						messages: synthesis.messages ?? [],
						isLoading: false,
						persona: "synthesis",
						roadmapId,
					});
				}

				return { personaSessions, conversations, synthesisSessionId };
			});
		} catch (_error) {
			// Ignore fetch errors - persona sessions are optional (legacy roadmaps won't have them)
		}
	},

	// ===========================================================================
	// WebSocket Event Handling
	// ===========================================================================

	handleWebSocketEvent: (event: WebSocketEvent) => {
		switch (event.type) {
			// Roadmap events
			case "roadmap:created":
				handleRoadmapCreated(event.payload, set, get);
				break;
			case "roadmap:updated":
				handleRoadmapUpdated(event.payload, set, get);
				break;
			case "roadmap:deleted":
				handleRoadmapDeleted(event.payload, set, get);
				break;

			// Session events for roadmaps
			case "session:started":
				handleSessionStarted(event.payload, set, get);
				break;
			case "session:completed":
				handleSessionCompleted(event.payload.sessionId, set, get);
				break;
			case "session:error":
				handleSessionError(
					event.payload.sessionId,
					event.payload.error,
					set,
					get,
				);
				break;

			// Turn events
			case "turn:started":
				handleTurnStarted(event.payload, set, get);
				break;
			case "turn:completed":
				handleTurnCompleted(event.payload, set, get);
				break;

			// Streaming events
			case "turn:message_delta":
				handleMessageDelta(event.payload, set, get);
				break;
			case "turn:segment_complete":
				handleSegmentComplete(event.payload, set, get);
				break;
			case "turn:thought_delta":
				handleThoughtDelta(event.payload, set, get);
				break;

			// Tool events
			case "turn:tool_started":
				handleToolStarted(event.payload, set, get);
				break;
			case "turn:tool_completed":
				handleToolCompleted(event.payload, set, get);
				break;

			// Question events
			case "questions:asked":
				handleQuestionsAsked(event.payload, set, get);
				break;
			case "questions:answered":
				handleQuestionsAnswered(event.payload, set, get);
				break;
			case "questions:submitted":
				handleQuestionsSubmitted(event.payload, set, get);
				break;

			// Persona events
			case "persona:roadmap_submitted":
				handlePersonaRoadmapSubmitted(event.payload, set, get);
				break;
		}
	},

	// ===========================================================================
	// Getters
	// ===========================================================================

	getRoadmap: (roadmapId: string) => {
		return get().roadmaps.find((r) => r.id === roadmapId);
	},

	getRoadmapDetails: (roadmapId: string) => {
		return get().roadmapDetails.get(roadmapId);
	},

	getConversation: (roadmapId: string) => {
		const { conversations, roadmaps } = get();
		// Search conversations for one with matching roadmapId field,
		// filtering out persona conversations to return only the main/synthesis conversation
		for (const conv of conversations.values()) {
			if (conv.roadmapId === roadmapId && !conv.persona) {
				return conv;
			}
		}
		// Fallback: find via roadmap's currentSessionId for legacy support
		const roadmap = roadmaps.find((r) => r.id === roadmapId);
		if (roadmap?.currentSessionId) {
			return conversations.get(roadmap.currentSessionId);
		}
		return undefined;
	},

	getConversationBySession: (sessionId: string) => {
		return get().conversations.get(sessionId);
	},

	getSelectedConversation: () => {
		const state = get();
		if (!state.selectedRoadmapId) return undefined;
		return state.getConversation(state.selectedRoadmapId);
	},
}));

// =============================================================================
// Event Handlers
// =============================================================================

type SetState = (fn: (state: RoadmapState) => Partial<RoadmapState>) => void;
type GetState = () => RoadmapState;

function handleRoadmapCreated(
	payload: RoadmapCreatedPayload,
	set: SetState,
	_get: GetState,
): void {
	set((state) => {
		// Check if already exists (from optimistic update)
		if (state.roadmaps.some((r) => r.id === payload.roadmapId)) {
			return {};
		}

		const newRoadmap: Roadmap = {
			id: payload.roadmapId,
			title: payload.title,
			status: payload.status,
			createdAt: Date.now(),
			updatedAt: Date.now(),
		};

		return {
			roadmaps: [...state.roadmaps, newRoadmap],
		};
	});
}

function handleRoadmapUpdated(
	payload: RoadmapUpdatedPayload,
	_set: SetState,
	get: GetState,
): void {
	// Refetch details to get the latest data
	const state = get();
	if (state.roadmapDetails.has(payload.roadmapId)) {
		state.fetchRoadmapDetails(payload.roadmapId).catch(() => {
			// Ignore fetch errors - will be retried on next view
		});
	}
}

function handleRoadmapDeleted(
	payload: RoadmapDeletedPayload,
	set: SetState,
	_get: GetState,
): void {
	set((state) => {
		const roadmaps = state.roadmaps.filter((r) => r.id !== payload.roadmapId);
		const roadmapDetails = new Map(state.roadmapDetails);
		roadmapDetails.delete(payload.roadmapId);
		const conversations = new Map(state.conversations);
		for (const [sessionId, conv] of conversations) {
			if (conv.roadmapId === payload.roadmapId) {
				conversations.delete(sessionId);
			}
		}
		const personaSessions = new Map(state.personaSessions);
		for (const [sessionId, _ps] of personaSessions) {
			if (_ps.roadmapId === payload.roadmapId) {
				personaSessions.delete(sessionId);
			}
		}
		// Reset persona UI state if the deleted roadmap is the active one
		const synthesisConv = state.synthesisSessionId
			? state.conversations.get(state.synthesisSessionId)
			: undefined;
		const resetPersonaState =
			synthesisConv?.roadmapId === payload.roadmapId ||
			[...state.personaSessions.values()].some(
				(ps) => ps.roadmapId === payload.roadmapId,
			);
		return {
			roadmaps,
			roadmapDetails,
			conversations,
			personaSessions,
			...(resetPersonaState
				? {
						synthesisSessionId: null,
						activePersonaTab: "visionary" as PersonaTab,
					}
				: {}),
		};
	});
}

function handleSessionStarted(
	payload: SessionStartedPayload,
	set: SetState,
	_get: GetState,
): void {
	if (payload.contextType === "roadmap") {
		set((state) => {
			const conversations = new Map(state.conversations);
			const existing = conversations.get(payload.sessionId);
			conversations.set(payload.sessionId, {
				...existing,
				messages: existing?.messages ?? [],
				isLoading: false,
				sessionId: payload.sessionId,
				sessionStatus: "active",
				roadmapId: payload.contextId,
			});

			// Also update roadmap's currentSessionId
			const roadmaps = state.roadmaps.map((r) =>
				r.id === payload.contextId
					? { ...r, currentSessionId: payload.sessionId }
					: r,
			);

			return { conversations, roadmaps };
		});
	} else if (payload.contextType === "persona") {
		// Persona session started — derive persona name from agentRole
		const persona = payload.agentRole ?? "unknown";

		set((state) => {
			// Use roadmapId from the session:started event payload (set by backend).
			// Falls back to searching existing personaSessions for compatibility.
			let roadmapId: string | undefined = payload.roadmapId;
			if (!roadmapId) {
				for (const [, ps] of state.personaSessions) {
					if (ps.persona === persona && ps.roadmapId) {
						roadmapId = ps.roadmapId;
						break;
					}
				}
			}

			const conversations = new Map(state.conversations);
			conversations.set(payload.sessionId, {
				messages: [],
				isLoading: false,
				sessionId: payload.sessionId,
				sessionStatus: "active",
				persona,
				roadmapId,
			});

			const personaSessions = new Map(state.personaSessions);
			personaSessions.set(payload.sessionId, {
				persona,
				sessionId: payload.sessionId,
				status: "running",
				roadmapId,
			});

			return { conversations, personaSessions };
		});
	}
}

function handleSessionCompleted(
	sessionId: string,
	set: SetState,
	_get: GetState,
): void {
	set((state) => {
		const conversations = new Map(state.conversations);
		const existing = conversations.get(sessionId);
		if (existing) {
			conversations.set(sessionId, {
				...existing,
				sessionStatus: "completed",
				streamingMessage: undefined,
			});
		}
		return { conversations };
	});
}

function handleSessionError(
	sessionId: string,
	error: string,
	set: SetState,
	_get: GetState,
): void {
	set((state) => {
		const conversations = new Map(state.conversations);
		const existing = conversations.get(sessionId);
		if (existing) {
			conversations.set(sessionId, {
				...existing,
				sessionStatus: "error",
				error,
				streamingMessage: undefined,
			});
		}

		// Also update persona session status if applicable
		const personaSessions = new Map(state.personaSessions);
		const ps = personaSessions.get(sessionId);
		if (ps) {
			personaSessions.set(sessionId, { ...ps, status: "failed" });
		}

		return { conversations, personaSessions };
	});
}

function handleTurnStarted(
	payload: TurnStartedPayload,
	set: SetState,
	_get: GetState,
): void {
	// Only create streaming state for assistant turns
	if (payload.role !== "assistant") return;

	set((state) => {
		const conversations = new Map(state.conversations);
		// Get existing or create minimal state (handles page refresh during active session)
		const existing = conversations.get(payload.sessionId) ?? {
			sessionId: payload.sessionId,
			sessionStatus: "active" as const,
			messages: [],
			isLoading: false,
		};

		conversations.set(payload.sessionId, {
			...existing,
			sessionId: payload.sessionId,
			sessionStatus: "active",
			streamingMessage: {
				turnId: payload.turnId,
				role: payload.role,
				segments: [{ index: 0, content: "", isComplete: false }],
				activeSegmentIndex: 0,
				thought: "",
				tools: [],
				questions: [],
				isComplete: false,
				agentRole: payload.agentRole,
			},
		});
		return { conversations };
	});
}

function handleTurnCompleted(
	payload: TurnCompletedPayload,
	set: SetState,
	_get: GetState,
): void {
	set((state) => {
		const conversations = new Map(state.conversations);
		const existing = conversations.get(payload.sessionId);
		if (existing?.streamingMessage?.turnId === payload.turnId) {
			// Build segments array from streaming segments
			const segments = existing.streamingMessage.segments.map((s) => ({
				index: s.index,
				content: s.content,
			}));

			// Convert streaming message to completed message
			const completedMessage: ChannelMessage = {
				id: payload.turnId,
				turnId: payload.turnId,
				role: existing.streamingMessage.role,
				segments,
				timestamp: Date.now(),
				toolCalls:
					existing.streamingMessage.tools.length > 0
						? existing.streamingMessage.tools
						: undefined,
				thought: existing.streamingMessage.thought || undefined,
				questions:
					existing.streamingMessage.questions.length > 0
						? existing.streamingMessage.questions
						: undefined,
				agentRole: existing.streamingMessage.agentRole,
			};

			conversations.set(payload.sessionId, {
				...existing,
				messages: [...existing.messages, completedMessage],
				streamingMessage: undefined,
			});
		}
		return { conversations };
	});
}

function handleMessageDelta(
	payload: TurnMessageDeltaPayload,
	set: SetState,
	_get: GetState,
): void {
	const segmentIndex = payload.segmentIndex ?? 0;

	set((state) => {
		const conversations = new Map(state.conversations);
		const existing = conversations.get(payload.sessionId);

		// If no streaming message exists for this turn, create one
		// This handles reconnection after page refresh during an active turn
		if (
			!existing?.streamingMessage ||
			existing.streamingMessage.turnId !== payload.turnId
		) {
			const baseConversation = existing ?? {
				sessionId: payload.sessionId,
				sessionStatus: "active" as const,
				messages: [],
				isLoading: false,
			};

			// Create streaming message with the delta content
			const segments = [];
			for (let i = 0; i <= segmentIndex; i++) {
				segments.push({
					index: i,
					content: i === segmentIndex ? payload.delta : "",
					isComplete: false,
				});
			}

			conversations.set(payload.sessionId, {
				...baseConversation,
				sessionId: payload.sessionId,
				sessionStatus: "active",
				streamingMessage: {
					turnId: payload.turnId,
					role: "assistant",
					segments,
					activeSegmentIndex: segmentIndex,
					thought: "",
					tools: [],
					questions: [],
					isComplete: false,
					agentRole: payload.agentRole,
				},
			});
			return { conversations };
		}

		// Existing streaming message - append delta
		const segments = [...existing.streamingMessage.segments];

		// Ensure we have a segment at this index
		while (segments.length <= segmentIndex) {
			segments.push({
				index: segments.length,
				content: "",
				isComplete: false,
			});
		}

		// Append delta to the segment
		const segment = segments[segmentIndex];
		if (segment) {
			segments[segmentIndex] = {
				...segment,
				content: segment.content + payload.delta,
			};
		}

		conversations.set(payload.sessionId, {
			...existing,
			streamingMessage: {
				...existing.streamingMessage,
				segments,
				activeSegmentIndex: segmentIndex,
			},
		});
		return { conversations };
	});
}

function handleSegmentComplete(
	payload: TurnSegmentCompletePayload,
	set: SetState,
	_get: GetState,
): void {
	set((state) => {
		const conversations = new Map(state.conversations);
		const existing = conversations.get(payload.sessionId);
		if (existing?.streamingMessage?.turnId === payload.turnId) {
			const segments = [...existing.streamingMessage.segments];

			// Ensure we have a segment at this index
			while (segments.length <= payload.segmentIndex) {
				segments.push({
					index: segments.length,
					content: "",
					isComplete: false,
				});
			}

			// Mark the segment as complete with the final content
			const segment = segments[payload.segmentIndex];
			if (segment) {
				segments[payload.segmentIndex] = {
					...segment,
					content: payload.content,
					isComplete: true,
				};
			}

			// Prepare for next segment
			const nextSegmentIndex = payload.segmentIndex + 1;
			if (segments.length <= nextSegmentIndex) {
				segments.push({
					index: nextSegmentIndex,
					content: "",
					isComplete: false,
				});
			}

			conversations.set(payload.sessionId, {
				...existing,
				streamingMessage: {
					...existing.streamingMessage,
					segments,
					activeSegmentIndex: nextSegmentIndex,
				},
			});
		}
		return { conversations };
	});
}

function handleThoughtDelta(
	payload: TurnThoughtDeltaPayload,
	set: SetState,
	_get: GetState,
): void {
	set((state) => {
		const conversations = new Map(state.conversations);
		const existing = conversations.get(payload.sessionId);
		if (existing?.streamingMessage?.turnId === payload.turnId) {
			conversations.set(payload.sessionId, {
				...existing,
				streamingMessage: {
					...existing.streamingMessage,
					thought: existing.streamingMessage.thought + payload.delta,
				},
			});
		}
		return { conversations };
	});
}

function handleToolStarted(
	payload: TurnToolStartedPayload,
	set: SetState,
	_get: GetState,
): void {
	set((state) => {
		const conversations = new Map(state.conversations);
		const existing = conversations.get(payload.sessionId);

		if (existing?.streamingMessage?.turnId === payload.turnId) {
			conversations.set(payload.sessionId, {
				...existing,
				streamingMessage: {
					...existing.streamingMessage,
					tools: [
						...existing.streamingMessage.tools,
						{
							id: payload.toolId,
							index: payload.index,
							name: payload.name,
							input: payload.input,
							status: "running" as const,
						},
					],
				},
			});
		}
		return { conversations };
	});
}

function handleToolCompleted(
	payload: TurnToolCompletedPayload,
	set: SetState,
	_get: GetState,
): void {
	set((state) => {
		const conversations = new Map(state.conversations);
		const existing = conversations.get(payload.sessionId);
		if (existing?.streamingMessage?.turnId === payload.turnId) {
			const tools = existing.streamingMessage.tools.map((t) =>
				t.id === payload.toolId
					? {
							...t,
							output: payload.output,
							status: payload.success
								? ("completed" as const)
								: ("error" as const),
						}
					: t,
			);
			conversations.set(payload.sessionId, {
				...existing,
				streamingMessage: {
					...existing.streamingMessage,
					tools,
				},
			});
		}
		return { conversations };
	});
}

function handleQuestionsAsked(
	payload: QuestionsAskedPayload,
	set: SetState,
	_get: GetState,
): void {
	set((state) => {
		const conversations = new Map(state.conversations);
		const existing = conversations.get(payload.sessionId);
		if (existing?.streamingMessage?.turnId === payload.turnId) {
			// Add questions to streaming message
			const questions: StreamingQuestion[] = payload.questions.map((q) => ({
				id: q.id,
				questionIndex: q.questionIndex,
				type: q.type,
				prompt: q.prompt,
				options: q.options,
				status: "pending" as const,
			}));

			conversations.set(payload.sessionId, {
				...existing,
				streamingMessage: {
					...existing.streamingMessage,
					questions: [...existing.streamingMessage.questions, ...questions],
				},
			});
		} else if (existing) {
			// Turn already completed, update the last message
			const messages = [...existing.messages];
			const lastMessage = messages[messages.length - 1];
			if (lastMessage?.turnId === payload.turnId) {
				const questions = payload.questions.map((q) => ({
					id: q.id,
					questionIndex: q.questionIndex,
					type: q.type,
					prompt: q.prompt,
					options: q.options,
					status: "pending" as const,
				}));

				messages[messages.length - 1] = {
					...lastMessage,
					questions: [...(lastMessage.questions ?? []), ...questions],
				};

				conversations.set(payload.sessionId, {
					...existing,
					messages,
				});
			}
		}
		return { conversations };
	});
}

function handleQuestionsAnswered(
	payload: QuestionsAnsweredPayload,
	set: SetState,
	_get: GetState,
): void {
	set((state) => {
		const conversations = new Map(state.conversations);
		const existing = conversations.get(payload.sessionId);
		if (!existing) return { conversations };

		// Update question in streaming message if present
		if (existing.streamingMessage?.turnId === payload.turnId) {
			const questions = existing.streamingMessage.questions.map((q) =>
				q.id === payload.questionId
					? { ...q, answer: payload.answer, status: "answered" as const }
					: q,
			);

			conversations.set(payload.sessionId, {
				...existing,
				streamingMessage: {
					...existing.streamingMessage,
					questions,
				},
			});
		} else {
			// Update question in completed messages
			const messages = existing.messages.map((msg) => {
				if (msg.turnId === payload.turnId && msg.questions) {
					return {
						...msg,
						questions: msg.questions.map((q) =>
							q.id === payload.questionId
								? { ...q, answer: payload.answer, status: "answered" as const }
								: q,
						),
					};
				}
				return msg;
			});

			conversations.set(payload.sessionId, {
				...existing,
				messages,
			});
		}

		return { conversations };
	});
}

function handleQuestionsSubmitted(
	payload: QuestionsSubmittedPayload,
	set: SetState,
	_get: GetState,
): void {
	set((state) => {
		const conversations = new Map(state.conversations);
		const existing = conversations.get(payload.sessionId);
		if (!existing) return { conversations };

		// Update questionsComment in streaming message if present
		if (existing.streamingMessage?.turnId === payload.turnId) {
			conversations.set(payload.sessionId, {
				...existing,
				streamingMessage: {
					...existing.streamingMessage,
					questionsComment: payload.comment,
					questions: existing.streamingMessage.questions?.map((q) =>
						q.status === "pending" ? { ...q, status: "skipped" as const } : q,
					),
				},
			});
		} else {
			// Update questionsComment in completed messages
			const messages = existing.messages.map((msg) => {
				if (msg.turnId === payload.turnId) {
					return {
						...msg,
						questionsComment: payload.comment,
						questions: msg.questions?.map((q) =>
							q.status === "pending" ? { ...q, status: "skipped" as const } : q,
						),
					};
				}
				return msg;
			});

			conversations.set(payload.sessionId, {
				...existing,
				messages,
			});
		}

		return { conversations };
	});
}

function handlePersonaRoadmapSubmitted(
	payload: PersonaRoadmapSubmittedPayload,
	set: SetState,
	_get: GetState,
): void {
	set((state) => {
		const personaSessions = new Map(state.personaSessions);
		const ps = personaSessions.get(payload.sessionId);
		if (ps) {
			personaSessions.set(payload.sessionId, {
				...ps,
				status: "completed",
				roadmapData: payload.roadmapData,
			});
		}

		// Check if all 4 personas are completed — scoped to the specific roadmapId
		const completedPersonas = new Set<string>();
		for (const [, session] of personaSessions) {
			if (
				session.roadmapId === payload.roadmapId &&
				session.status === "completed"
			) {
				completedPersonas.add(session.persona);
			}
		}
		const allDone = PERSONA_NAMES.every((p) => completedPersonas.has(p));

		return {
			personaSessions,
			...(allDone ? { activePersonaTab: "synthesis" } : {}),
		};
	});
}

// =============================================================================
// Helpers
// =============================================================================
