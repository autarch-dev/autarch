import { create } from "zustand";
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
	type WorkflowApprovalNeededPayload,
	type WorkflowCreatedPayload,
	type WorkflowStageChangedPayload,
} from "@/shared/schemas/events";
import type { WorkflowStatus } from "@/shared/schemas/workflow";

// =============================================================================
// Types
// =============================================================================

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
	contextType: "channel" | "workflow";
	contextId: string;
	agentRole: string;
	status: "active" | "completed" | "error";
	currentTurn?: StreamingTurn;
	error?: string;
}

/** State of a workflow */
export interface WorkflowState {
	id: string;
	title: string;
	status: WorkflowStatus;
	awaitingApproval: boolean;
	pendingArtifactType?: string;
	pendingArtifactId?: string;
	currentSessionId?: string;
}

// =============================================================================
// Store State
// =============================================================================

interface WebSocketState {
	// Connection state
	connected: boolean;
	error: string | null;

	// Indexing state
	indexingProgress: IndexingProgressPayload | null;

	// Agent system state
	workflows: Map<string, WorkflowState>;
	sessions: Map<string, SessionState>;

	// Actions
	connect: () => void;
	disconnect: () => void;

	// Workflow actions
	getWorkflow: (workflowId: string) => WorkflowState | undefined;
	getWorkflowsArray: () => WorkflowState[];

	// Session actions
	getSession: (sessionId: string) => SessionState | undefined;
	getSessionByContext: (
		contextType: string,
		contextId: string,
	) => SessionState | undefined;
}

// =============================================================================
// WebSocket Instance
// =============================================================================

let ws: WebSocket | null = null;

// =============================================================================
// Store
// =============================================================================

export const useWebSocketStore = create<WebSocketState>((set, get) => ({
	// Initial state
	connected: false,
	error: null,
	indexingProgress: null,
	workflows: new Map(),
	sessions: new Map(),

	// Connection actions
	connect: () => {
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
			set({ connected: true, error: null });
		};

		ws.onclose = () => {
			set({ connected: false });
			ws = null;
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

				handleEvent(parsed.data, set, get);
			} catch (err) {
				console.warn("Failed to parse WebSocket message:", err);
			}
		};
	},

	disconnect: () => {
		if (ws) {
			ws.close();
			ws = null;
		}
		set({ connected: false });
	},

	// Workflow getters
	getWorkflow: (workflowId: string) => {
		return get().workflows.get(workflowId);
	},

	getWorkflowsArray: () => {
		return Array.from(get().workflows.values());
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
	switch (event.type) {
		// Indexing events
		case "indexing:progress":
			set({ indexingProgress: event.payload });
			break;

		// Workflow events
		case "workflow:created":
			handleWorkflowCreated(event.payload, set, get);
			break;
		case "workflow:approval_needed":
			handleWorkflowApprovalNeeded(event.payload, set, get);
			break;
		case "workflow:stage_changed":
			handleWorkflowStageChanged(event.payload, set, get);
			break;
		case "workflow:completed":
			handleWorkflowCompleted(event.payload.workflowId, set, get);
			break;
		case "workflow:error":
			handleWorkflowError(
				event.payload.workflowId,
				event.payload.error,
				set,
				get,
			);
			break;

		// Session events
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
// Workflow Handlers
// =============================================================================

function handleWorkflowCreated(
	payload: WorkflowCreatedPayload,
	set: (fn: (state: WebSocketState) => Partial<WebSocketState>) => void,
	_get: () => WebSocketState,
): void {
	set((state) => {
		const workflows = new Map(state.workflows);
		workflows.set(payload.workflowId, {
			id: payload.workflowId,
			title: payload.title,
			status: payload.status,
			awaitingApproval: false,
		});
		return { workflows };
	});
}

function handleWorkflowApprovalNeeded(
	payload: WorkflowApprovalNeededPayload,
	set: (fn: (state: WebSocketState) => Partial<WebSocketState>) => void,
	_get: () => WebSocketState,
): void {
	set((state) => {
		const workflows = new Map(state.workflows);
		const workflow = workflows.get(payload.workflowId);
		if (workflow) {
			workflows.set(payload.workflowId, {
				...workflow,
				awaitingApproval: true,
				pendingArtifactType: payload.artifactType,
				pendingArtifactId: payload.artifactId,
			});
		}
		return { workflows };
	});
}

function handleWorkflowStageChanged(
	payload: WorkflowStageChangedPayload,
	set: (fn: (state: WebSocketState) => Partial<WebSocketState>) => void,
	_get: () => WebSocketState,
): void {
	set((state) => {
		const workflows = new Map(state.workflows);
		const workflow = workflows.get(payload.workflowId);
		if (workflow) {
			workflows.set(payload.workflowId, {
				...workflow,
				status: payload.newStage,
				awaitingApproval: false,
				pendingArtifactType: undefined,
				pendingArtifactId: undefined,
				currentSessionId: payload.sessionId,
			});
		}
		return { workflows };
	});
}

function handleWorkflowCompleted(
	workflowId: string,
	set: (fn: (state: WebSocketState) => Partial<WebSocketState>) => void,
	_get: () => WebSocketState,
): void {
	set((state) => {
		const workflows = new Map(state.workflows);
		const workflow = workflows.get(workflowId);
		if (workflow) {
			workflows.set(workflowId, {
				...workflow,
				status: "done",
				awaitingApproval: false,
				currentSessionId: undefined,
			});
		}
		return { workflows };
	});
}

function handleWorkflowError(
	workflowId: string,
	_error: string,
	set: (fn: (state: WebSocketState) => Partial<WebSocketState>) => void,
	_get: () => WebSocketState,
): void {
	set((state) => {
		const workflows = new Map(state.workflows);
		const workflow = workflows.get(workflowId);
		if (workflow) {
			workflows.set(workflowId, {
				...workflow,
				awaitingApproval: false,
			});
		}
		return { workflows };
	});
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
