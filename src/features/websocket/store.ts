import { create } from "zustand";
import {
	useDiscussionsStore,
	useWorkflowsStore,
} from "@/features/dashboard/store";
import { useRoadmapStore } from "@/features/roadmap";
import {
	type IndexingProgressPayload,
	type SessionStartedPayload,
	type TurnCompletedPayload,
	type TurnMessageDeltaPayload,
	type TurnStartedPayload,
	type TurnThoughtDeltaPayload,
	type TurnToolCompletedPayload,
	type TurnToolStartedPayload,
	type WebSocketEvent,
	WebSocketEventSchema,
} from "@/shared/schemas/events";

// =============================================================================
// Types
// =============================================================================

/** Connection status for the WebSocket */
export type ConnectionStatus = "connected" | "reconnecting" | "disconnected";

/** State of an active tool call */
export interface ToolCallState {
	id: string;
	name: string;
	input: unknown;
	output?: unknown;
	status: "running" | "completed" | "error";
	success?: boolean;
}

/** State of a streaming turn */
export interface StreamingTurn {
	turnId: string;
	role: "user" | "assistant";
	messageBuffer: string;
	thoughtBuffer: string;
	activeTools: ToolCallState[];
	isComplete: boolean;
	tokenCount?: number;
}

/** State of an active session */
export interface SessionState {
	id: string;
	contextType: "channel" | "workflow" | "roadmap" | "subtask" | "persona";
	contextId: string;
	agentRole: string;
	status: "active" | "completed" | "error";
	currentTurn?: StreamingTurn;
	error?: string;
}

// =============================================================================
// Store State
// =============================================================================

interface WebSocketState {
	// Connection state
	connectionStatus: ConnectionStatus;
	retryCount: number;
	error: string | null;

	// Indexing state
	indexingProgress: IndexingProgressPayload | null;

	// Session tracking for streaming UI
	sessions: Map<string, SessionState>;

	// Actions
	connect: () => void;
	disconnect: () => void;
	reconnect: () => void;

	// Session actions
	getSession: (sessionId: string) => SessionState | undefined;
	getSessionByContext: (
		contextType: string,
		contextId: string,
	) => SessionState | undefined;
}

// =============================================================================
// WebSocket Instance & Timers
// =============================================================================

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
let pongTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
let retryCount = 0;
let intentionalDisconnect = false;
let isReconnecting = false;

// =============================================================================
// Helpers
// =============================================================================

function clearAllTimers(): void {
	if (reconnectTimer !== null) {
		clearTimeout(reconnectTimer);
		reconnectTimer = null;
	}
	if (heartbeatInterval !== null) {
		clearInterval(heartbeatInterval);
		heartbeatInterval = null;
	}
	if (pongTimeoutTimer !== null) {
		clearTimeout(pongTimeoutTimer);
		pongTimeoutTimer = null;
	}
}

function handlePongTimeout(): void {
	if (ws?.readyState === WebSocket.OPEN) {
		ws.close(4000);
	}
}

function startHeartbeat(): void {
	heartbeatInterval = setInterval(() => {
		if (ws?.readyState === WebSocket.OPEN) {
			ws.send(JSON.stringify({ type: "ping" }));
			pongTimeoutTimer = setTimeout(handlePongTimeout, 7000);
		}
	}, 30000);
}

function getActiveView(): { view: string; id: string } | null {
	const match = window.location.pathname.match(
		/\/dashboard\/(channel|workflow|roadmap)\/(.+)/,
	);
	if (match?.[1] && match[2]) {
		return { view: match[1], id: match[2] };
	}
	return null;
}

function scheduleReconnect(
	set: (
		state:
			| Partial<WebSocketState>
			| ((state: WebSocketState) => Partial<WebSocketState>),
	) => void,
): void {
	const delay = Math.min(1000 * 2 ** retryCount, 30000);

	if (retryCount >= 10) {
		set({ connectionStatus: "disconnected" });
		isReconnecting = false;
		return;
	}

	retryCount++;
	set({ connectionStatus: "reconnecting", retryCount });

	reconnectTimer = setTimeout(() => {
		if (!intentionalDisconnect) {
			isReconnecting = true;
			connectInternal(set);
		}
	}, delay);
}

function connectInternal(
	set: (
		state:
			| Partial<WebSocketState>
			| ((state: WebSocketState) => Partial<WebSocketState>),
	) => void,
): void {
	if (
		ws?.readyState === WebSocket.OPEN ||
		ws?.readyState === WebSocket.CONNECTING
	) {
		return;
	}

	const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
	const url = `${protocol}//${window.location.host}/ws`;

	ws = new WebSocket(url);

	ws.onopen = () => {
		set({ connectionStatus: "connected", error: null, retryCount: 0 });
		startHeartbeat();

		if (isReconnecting) {
			const activeView = getActiveView();
			if (activeView) {
				const { view, id } = activeView;
				switch (view) {
					case "channel":
						useDiscussionsStore.getState().fetchChannels();
						useDiscussionsStore.getState().fetchHistory(id);
						break;
					case "workflow":
						useWorkflowsStore.getState().fetchWorkflows();
						useWorkflowsStore.getState().fetchHistory(id);
						break;
					case "roadmap":
						useRoadmapStore.getState().fetchRoadmaps();
						useRoadmapStore.getState().fetchHistory(id);
						break;
				}
			}
			retryCount = 0;
			isReconnecting = false;
		}
	};

	ws.onclose = () => {
		clearAllTimers();
		ws = null;

		if (intentionalDisconnect) {
			set({ connectionStatus: "disconnected" });
			return;
		}

		scheduleReconnect(set);
	};

	ws.onerror = () => {
		set({ error: "WebSocket connection error" });
	};

	ws.onmessage = (event) => {
		try {
			const data = JSON.parse(event.data);
			const parsed = WebSocketEventSchema.safeParse(data);

			if (!parsed.success) {
				console.warn("Invalid WebSocket event:", parsed.error);
				return;
			}

			if (parsed.data.type === "pong") {
				if (pongTimeoutTimer !== null) {
					clearTimeout(pongTimeoutTimer);
					pongTimeoutTimer = null;
				}
				return;
			}

			handleEvent(parsed.data, set, useWebSocketStore.getState);
		} catch (err) {
			console.warn("Failed to parse WebSocket message:", err);
		}
	};
}

// =============================================================================
// Store
// =============================================================================

export const useWebSocketStore = create<WebSocketState>((set, get) => ({
	// Initial state
	connectionStatus: "disconnected",
	retryCount: 0,
	error: null,
	indexingProgress: null,
	sessions: new Map(),

	// Connection actions
	connect: () => {
		intentionalDisconnect = false;
		clearAllTimers();
		connectInternal(set);
	},

	disconnect: () => {
		intentionalDisconnect = true;
		clearAllTimers();
		retryCount = 0;
		isReconnecting = false;
		if (
			ws &&
			(ws.readyState === WebSocket.OPEN ||
				ws.readyState === WebSocket.CONNECTING)
		) {
			ws.close();
		}
		ws = null;
		set({ connectionStatus: "disconnected", retryCount: 0 });
	},

	reconnect: () => {
		intentionalDisconnect = false;
		retryCount = 0;
		isReconnecting = false;
		clearAllTimers();
		set({ connectionStatus: "reconnecting", retryCount: 0 });
		connectInternal(set);
	},

	// Session getters
	getSession: (sessionId: string) => {
		return get().sessions.get(sessionId);
	},

	getSessionByContext: (contextType: string, contextId: string) => {
		const sessions = get().sessions;
		for (const session of sessions.values()) {
			if (
				session.contextType === contextType &&
				session.contextId === contextId &&
				session.status === "active"
			) {
				return session;
			}
		}
		return undefined;
	},
}));

// =============================================================================
// Event Handlers
// =============================================================================

function handleEvent(
	event: WebSocketEvent,
	set: (
		state:
			| Partial<WebSocketState>
			| ((state: WebSocketState) => Partial<WebSocketState>),
	) => void,
	get: () => WebSocketState,
): void {
	// Forward relevant events to the discussions store
	// This handles channel events and session/turn events for channels
	useDiscussionsStore.getState().handleWebSocketEvent(event);

	// Forward relevant events to the workflows store
	// This handles workflow events and session/turn events for workflows
	useWorkflowsStore.getState().handleWebSocketEvent(event);

	// Forward relevant events to the roadmap store
	// This handles roadmap events and session/turn events for roadmaps
	useRoadmapStore.getState().handleWebSocketEvent(event);

	switch (event.type) {
		// Indexing events
		case "indexing:progress":
			set({ indexingProgress: event.payload });
			break;

		// Workflow events - handled by workflowsStore via forwarding above
		case "workflow:created":
		case "workflow:approval_needed":
		case "workflow:stage_changed":
		case "workflow:completed":
		case "workflow:error":
			// Handled by workflowsStore
			break;

		// Channel events - handled by discussionsStore via forwarding above
		case "channel:created":
		case "channel:deleted":
			// Handled by discussionsStore
			break;

		// Roadmap events - handled by roadmapStore via forwarding above
		case "roadmap:created":
		case "roadmap:updated":
		case "roadmap:deleted":
			// Handled by roadmapStore
			break;

		// Session events - update local tracking for streaming UI
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
	}
}

// =============================================================================
// Session Handlers
// =============================================================================

function handleSessionStarted(
	payload: SessionStartedPayload,
	set: (fn: (state: WebSocketState) => Partial<WebSocketState>) => void,
	_get: () => WebSocketState,
): void {
	set((state) => {
		const sessions = new Map(state.sessions);
		sessions.set(payload.sessionId, {
			id: payload.sessionId,
			contextType: payload.contextType,
			contextId: payload.contextId,
			agentRole: payload.agentRole,
			status: "active",
		});
		return { sessions };
	});
}

function handleSessionCompleted(
	sessionId: string,
	set: (fn: (state: WebSocketState) => Partial<WebSocketState>) => void,
	_get: () => WebSocketState,
): void {
	set((state) => {
		const sessions = new Map(state.sessions);
		const session = sessions.get(sessionId);
		if (session) {
			sessions.set(sessionId, {
				...session,
				status: "completed",
			});
		}
		return { sessions };
	});
}

function handleSessionError(
	sessionId: string,
	error: string,
	set: (fn: (state: WebSocketState) => Partial<WebSocketState>) => void,
	_get: () => WebSocketState,
): void {
	set((state) => {
		const sessions = new Map(state.sessions);
		const session = sessions.get(sessionId);
		if (session) {
			sessions.set(sessionId, {
				...session,
				status: "error",
				error,
			});
		}
		return { sessions };
	});
}

// =============================================================================
// Turn Handlers
// =============================================================================

function handleTurnStarted(
	payload: TurnStartedPayload,
	set: (fn: (state: WebSocketState) => Partial<WebSocketState>) => void,
	_get: () => WebSocketState,
): void {
	set((state) => {
		const sessions = new Map(state.sessions);
		const session = sessions.get(payload.sessionId);
		if (session) {
			sessions.set(payload.sessionId, {
				...session,
				currentTurn: {
					turnId: payload.turnId,
					role: payload.role,
					messageBuffer: "",
					thoughtBuffer: "",
					activeTools: [],
					isComplete: false,
				},
			});
		}
		return { sessions };
	});
}

function handleTurnCompleted(
	payload: TurnCompletedPayload,
	set: (fn: (state: WebSocketState) => Partial<WebSocketState>) => void,
	_get: () => WebSocketState,
): void {
	set((state) => {
		const sessions = new Map(state.sessions);
		const session = sessions.get(payload.sessionId);
		if (session?.currentTurn) {
			sessions.set(payload.sessionId, {
				...session,
				currentTurn: {
					...session.currentTurn,
					isComplete: true,
					tokenCount: payload.tokenCount,
				},
			});
		}
		return { sessions };
	});
}

// =============================================================================
// Streaming Handlers
// =============================================================================

function handleMessageDelta(
	payload: TurnMessageDeltaPayload,
	set: (fn: (state: WebSocketState) => Partial<WebSocketState>) => void,
	_get: () => WebSocketState,
): void {
	set((state) => {
		const sessions = new Map(state.sessions);
		const session = sessions.get(payload.sessionId);
		if (session?.currentTurn) {
			sessions.set(payload.sessionId, {
				...session,
				currentTurn: {
					...session.currentTurn,
					messageBuffer: session.currentTurn.messageBuffer + payload.delta,
				},
			});
		}
		return { sessions };
	});
}

function handleThoughtDelta(
	payload: TurnThoughtDeltaPayload,
	set: (fn: (state: WebSocketState) => Partial<WebSocketState>) => void,
	_get: () => WebSocketState,
): void {
	set((state) => {
		const sessions = new Map(state.sessions);
		const session = sessions.get(payload.sessionId);
		if (session?.currentTurn) {
			sessions.set(payload.sessionId, {
				...session,
				currentTurn: {
					...session.currentTurn,
					thoughtBuffer: session.currentTurn.thoughtBuffer + payload.delta,
				},
			});
		}
		return { sessions };
	});
}

// =============================================================================
// Tool Handlers
// =============================================================================

function handleToolStarted(
	payload: TurnToolStartedPayload,
	set: (fn: (state: WebSocketState) => Partial<WebSocketState>) => void,
	_get: () => WebSocketState,
): void {
	set((state) => {
		const sessions = new Map(state.sessions);
		const session = sessions.get(payload.sessionId);
		if (session?.currentTurn) {
			sessions.set(payload.sessionId, {
				...session,
				currentTurn: {
					...session.currentTurn,
					activeTools: [
						...session.currentTurn.activeTools,
						{
							id: payload.toolId,
							name: payload.name,
							input: payload.input,
							status: "running",
						},
					],
				},
			});
		}
		return { sessions };
	});
}

function handleToolCompleted(
	payload: TurnToolCompletedPayload,
	set: (fn: (state: WebSocketState) => Partial<WebSocketState>) => void,
	_get: () => WebSocketState,
): void {
	set((state) => {
		const sessions = new Map(state.sessions);
		const session = sessions.get(payload.sessionId);
		if (session?.currentTurn) {
			const activeTools = session.currentTurn.activeTools.map((tool) =>
				tool.id === payload.toolId
					? {
							...tool,
							output: payload.output,
							status: payload.success
								? ("completed" as const)
								: ("error" as const),
							success: payload.success,
						}
					: tool,
			);
			sessions.set(payload.sessionId, {
				...session,
				currentTurn: {
					...session.currentTurn,
					activeTools,
				},
			});
		}
		return { sessions };
	});
}
