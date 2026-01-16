/**
 * Workflows Store
 *
 * Zustand store for managing workflows and their conversations.
 * Handles workflow CRUD, message history, and real-time streaming updates.
 */

import { create } from "zustand";
import type { ChannelMessage, MessageQuestion } from "@/shared/schemas/channel";
import type {
	QuestionsAnsweredPayload,
	QuestionsAskedPayload,
	SessionStartedPayload,
	TurnCompletedPayload,
	TurnMessageDeltaPayload,
	TurnSegmentCompletePayload,
	TurnStartedPayload,
	TurnThoughtDeltaPayload,
	TurnToolCompletedPayload,
	TurnToolStartedPayload,
	WebSocketEvent,
	WorkflowApprovalNeededPayload,
	WorkflowCreatedPayload,
	WorkflowErrorPayload,
	WorkflowStageChangedPayload,
} from "@/shared/schemas/events";
import type {
	ResearchCard,
	ScopeCard,
	Workflow,
	WorkflowHistoryResponse,
	WorkflowStatus,
} from "@/shared/schemas/workflow";

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
	isComplete: boolean;
}

/** Per-workflow conversation state */
export interface WorkflowConversationState {
	sessionId?: string;
	sessionStatus?: "active" | "completed" | "error";
	messages: ChannelMessage[];
	streamingMessage?: StreamingMessage;
	isLoading: boolean;
	error?: string;
}

// =============================================================================
// Store State
// =============================================================================

interface WorkflowsState {
	// Workflow list
	workflows: Workflow[];
	workflowsLoading: boolean;
	workflowsError: string | null;

	// Per-workflow conversation state
	conversations: Map<string, WorkflowConversationState>;

	// Selected workflow
	selectedWorkflowId: string | null;

	// Pending scope cards (for approval UI)
	pendingScopeCards: Map<string, ScopeCard>;

	// Pending research cards (for approval UI)
	pendingResearchCards: Map<string, ResearchCard>;

	// Actions - Workflow CRUD
	fetchWorkflows: () => Promise<void>;
	createWorkflow: (title: string, description?: string) => Promise<Workflow>;
	selectWorkflow: (workflowId: string | null) => void;

	// Actions - Conversation
	fetchHistory: (workflowId: string) => Promise<void>;
	sendMessage: (workflowId: string, content: string) => Promise<void>;

	// Actions - Approval
	approveArtifact: (workflowId: string) => Promise<void>;
	requestChanges: (workflowId: string, feedback: string) => Promise<void>;

	// Actions - WebSocket event handling
	handleWebSocketEvent: (event: WebSocketEvent) => void;

	// Getters
	getWorkflow: (workflowId: string) => Workflow | undefined;
	getConversation: (
		workflowId: string,
	) => WorkflowConversationState | undefined;
	getSelectedConversation: () => WorkflowConversationState | undefined;
	getPendingScopeCard: (workflowId: string) => ScopeCard | undefined;
	getPendingResearchCard: (workflowId: string) => ResearchCard | undefined;
}

// =============================================================================
// Store
// =============================================================================

export const useWorkflowsStore = create<WorkflowsState>((set, get) => ({
	// Initial state
	workflows: [],
	workflowsLoading: false,
	workflowsError: null,
	conversations: new Map(),
	selectedWorkflowId: null,
	pendingScopeCards: new Map(),
	pendingResearchCards: new Map(),

	// ===========================================================================
	// Workflow CRUD
	// ===========================================================================

	fetchWorkflows: async () => {
		set({ workflowsLoading: true, workflowsError: null });
		try {
			const response = await fetch("/api/workflows");
			if (!response.ok) {
				throw new Error("Failed to fetch workflows");
			}
			const workflows: Workflow[] = await response.json();
			set({ workflows, workflowsLoading: false });
		} catch (error) {
			set({
				workflowsError:
					error instanceof Error ? error.message : "Unknown error",
				workflowsLoading: false,
			});
		}
	},

	createWorkflow: async (title: string, description?: string) => {
		const response = await fetch("/api/workflows", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ title, description }),
		});

		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error ?? "Failed to create workflow");
		}

		const workflow: Workflow = await response.json();

		// Don't add optimistically - the WebSocket workflow:created event handles this.
		// Adding here causes a race condition with duplicate entries.
		// But we DO need to ensure the workflow is in state before returning
		// so the caller can select it. Update if not already present.
		set((state) => {
			if (state.workflows.some((w) => w.id === workflow.id)) {
				return {}; // Already added by WebSocket event
			}
			return { workflows: [...state.workflows, workflow] };
		});

		return workflow;
	},

	selectWorkflow: (workflowId: string | null) => {
		set({ selectedWorkflowId: workflowId });
	},

	// ===========================================================================
	// Conversation Management
	// ===========================================================================

	fetchHistory: async (workflowId: string) => {
		// Mark as loading
		set((state) => {
			const conversations = new Map(state.conversations);
			const existing = conversations.get(workflowId) ?? {
				messages: [],
				isLoading: true,
			};
			conversations.set(workflowId, { ...existing, isLoading: true });
			return { conversations };
		});

		try {
			const response = await fetch(`/api/workflows/${workflowId}/history`);
			if (!response.ok) {
				throw new Error("Failed to fetch history");
			}

			const history: WorkflowHistoryResponse = await response.json();

			set((state) => {
				const conversations = new Map(state.conversations);
				conversations.set(workflowId, {
					sessionId: history.sessionId,
					sessionStatus: history.sessionStatus,
					messages: history.messages,
					isLoading: false,
				});

				// Update workflow in list with latest data
				const workflows = state.workflows.map((w) =>
					w.id === workflowId ? history.workflow : w,
				);

				// Store pending scope card if present
				const pendingScopeCards = new Map(state.pendingScopeCards);
				if (history.pendingScopeCard) {
					pendingScopeCards.set(workflowId, history.pendingScopeCard);
				}

				// Store pending research card if present
				const pendingResearchCards = new Map(state.pendingResearchCards);
				if (history.pendingResearchCard) {
					pendingResearchCards.set(workflowId, history.pendingResearchCard);
				}

				return {
					conversations,
					workflows,
					pendingScopeCards,
					pendingResearchCards,
				};
			});
		} catch (error) {
			set((state) => {
				const conversations = new Map(state.conversations);
				const existing = conversations.get(workflowId);
				conversations.set(workflowId, {
					...existing,
					messages: existing?.messages ?? [],
					isLoading: false,
					error: error instanceof Error ? error.message : "Unknown error",
				});
				return { conversations };
			});
		}
	},

	sendMessage: async (workflowId: string, content: string) => {
		const state = get();
		const workflow = state.workflows.find((w) => w.id === workflowId);
		let sessionId = state.conversations.get(workflowId)?.sessionId;

		// Use current session from workflow if available
		if (!sessionId && workflow?.currentSessionId) {
			sessionId = workflow.currentSessionId;
		}

		// If no session, we need to wait for one to be created
		// Workflows should already have a session from creation
		if (!sessionId) {
			throw new Error("No active session for this workflow");
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
			const existing = conversations.get(workflowId);
			conversations.set(workflowId, {
				...existing,
				messages: [...(existing?.messages ?? []), userMessage],
				isLoading: false,
				sessionId,
				sessionStatus: "active",
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

	// ===========================================================================
	// Approval Actions
	// ===========================================================================

	approveArtifact: async (workflowId: string) => {
		const response = await fetch(`/api/workflows/${workflowId}/approve`, {
			method: "POST",
		});

		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error ?? "Failed to approve artifact");
		}

		// Clear pending scope card
		set((state) => {
			const pendingScopeCards = new Map(state.pendingScopeCards);
			pendingScopeCards.delete(workflowId);
			return { pendingScopeCards };
		});
	},

	requestChanges: async (workflowId: string, feedback: string) => {
		const response = await fetch(
			`/api/workflows/${workflowId}/request-changes`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ feedback }),
			},
		);

		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error ?? "Failed to request changes");
		}

		// Update workflow to clear awaiting approval
		set((state) => {
			const workflows = state.workflows.map((w) =>
				w.id === workflowId
					? { ...w, awaitingApproval: false, pendingArtifactType: undefined }
					: w,
			);
			const pendingScopeCards = new Map(state.pendingScopeCards);
			pendingScopeCards.delete(workflowId);
			return { workflows, pendingScopeCards };
		});
	},

	// ===========================================================================
	// WebSocket Event Handling
	// ===========================================================================

	handleWebSocketEvent: (event: WebSocketEvent) => {
		switch (event.type) {
			// Workflow events
			case "workflow:created":
				handleWorkflowCreated(event.payload, set, get);
				break;
			case "workflow:stage_changed":
				handleWorkflowStageChanged(event.payload, set, get);
				break;
			case "workflow:approval_needed":
				handleWorkflowApprovalNeeded(event.payload, set, get);
				break;
			case "workflow:completed":
				handleWorkflowCompleted(event.payload.workflowId, set, get);
				break;
			case "workflow:error":
				handleWorkflowError(event.payload, set, get);
				break;

			// Session events for workflows
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
		}
	},

	// ===========================================================================
	// Getters
	// ===========================================================================

	getWorkflow: (workflowId: string) => {
		return get().workflows.find((w) => w.id === workflowId);
	},

	getConversation: (workflowId: string) => {
		return get().conversations.get(workflowId);
	},

	getSelectedConversation: () => {
		const { selectedWorkflowId, conversations } = get();
		if (!selectedWorkflowId) return undefined;
		return conversations.get(selectedWorkflowId);
	},

	getPendingScopeCard: (workflowId: string) => {
		return get().pendingScopeCards.get(workflowId);
	},

	getPendingResearchCard: (workflowId: string) => {
		return get().pendingResearchCards.get(workflowId);
	},
}));

// =============================================================================
// Event Handlers
// =============================================================================

type SetState = (
	fn: (state: WorkflowsState) => Partial<WorkflowsState>,
) => void;
type GetState = () => WorkflowsState;

function handleWorkflowCreated(
	payload: WorkflowCreatedPayload,
	set: SetState,
	_get: GetState,
): void {
	set((state) => {
		// Check if already exists (from optimistic update)
		if (state.workflows.some((w) => w.id === payload.workflowId)) {
			return {};
		}

		const newWorkflow: Workflow = {
			id: payload.workflowId,
			title: payload.title,
			status: payload.status,
			priority: "medium",
			awaitingApproval: false,
			createdAt: Date.now(),
			updatedAt: Date.now(),
		};

		return {
			workflows: [...state.workflows, newWorkflow],
		};
	});
}

function handleWorkflowStageChanged(
	payload: WorkflowStageChangedPayload,
	set: SetState,
	_get: GetState,
): void {
	set((state) => {
		const workflows = state.workflows.map((w) =>
			w.id === payload.workflowId
				? {
						...w,
						status: payload.newStage,
						currentSessionId: payload.sessionId,
						awaitingApproval: false,
						pendingArtifactType: undefined,
						updatedAt: Date.now(),
					}
				: w,
		);

		// Update conversation with new session if provided
		const conversations = new Map(state.conversations);
		if (payload.sessionId) {
			const existing = conversations.get(payload.workflowId);
			conversations.set(payload.workflowId, {
				...existing,
				messages: existing?.messages ?? [],
				isLoading: false,
				sessionId: payload.sessionId,
				sessionStatus: "active",
			});
		}

		return { workflows, conversations };
	});
}

function handleWorkflowApprovalNeeded(
	payload: WorkflowApprovalNeededPayload,
	set: SetState,
	_get: GetState,
): void {
	set((state) => {
		const workflows = state.workflows.map((w) =>
			w.id === payload.workflowId
				? {
						...w,
						awaitingApproval: true,
						pendingArtifactType:
							payload.artifactType as Workflow["pendingArtifactType"],
						updatedAt: Date.now(),
					}
				: w,
		);

		return { workflows };
	});

	// Fetch the scope card if it's a scope_card approval
	if (payload.artifactType === "scope_card") {
		fetchScopeCard(payload.workflowId, payload.artifactId, set);
	}

	// Fetch the research card if it's a research approval
	if (payload.artifactType === "research") {
		fetchResearchCard(payload.workflowId, payload.artifactId, set);
	}
}

async function fetchScopeCard(
	workflowId: string,
	_scopeCardId: string,
	set: SetState,
): Promise<void> {
	try {
		const response = await fetch(`/api/workflows/${workflowId}/scope-card`);
		if (response.ok) {
			const scopeCard: ScopeCard = await response.json();
			set((state) => {
				const pendingScopeCards = new Map(state.pendingScopeCards);
				pendingScopeCards.set(workflowId, scopeCard);
				return { pendingScopeCards };
			});
		}
	} catch {
		// Ignore fetch errors - scope card will be fetched with history
	}
}

async function fetchResearchCard(
	workflowId: string,
	_researchCardId: string,
	set: SetState,
): Promise<void> {
	try {
		const response = await fetch(`/api/workflows/${workflowId}/research-card`);
		if (response.ok) {
			const researchCard: ResearchCard = await response.json();
			set((state) => {
				const pendingResearchCards = new Map(state.pendingResearchCards);
				pendingResearchCards.set(workflowId, researchCard);
				return { pendingResearchCards };
			});
		}
	} catch {
		// Ignore fetch errors - research card will be fetched with history
	}
}

function handleWorkflowCompleted(
	workflowId: string,
	set: SetState,
	_get: GetState,
): void {
	set((state) => {
		const workflows = state.workflows.map((w) =>
			w.id === workflowId
				? {
						...w,
						status: "done" as WorkflowStatus,
						awaitingApproval: false,
						pendingArtifactType: undefined,
						updatedAt: Date.now(),
					}
				: w,
		);

		return { workflows };
	});
}

function handleWorkflowError(
	payload: WorkflowErrorPayload,
	set: SetState,
	_get: GetState,
): void {
	set((state) => {
		const conversations = new Map(state.conversations);
		const existing = conversations.get(payload.workflowId);
		if (existing) {
			conversations.set(payload.workflowId, {
				...existing,
				sessionStatus: "error",
				error: payload.error,
				streamingMessage: undefined,
			});
		}
		return { conversations };
	});
}

function handleSessionStarted(
	payload: SessionStartedPayload,
	set: SetState,
	_get: GetState,
): void {
	if (payload.contextType !== "workflow") return;

	set((state) => {
		const conversations = new Map(state.conversations);
		const existing = conversations.get(payload.contextId);
		conversations.set(payload.contextId, {
			...existing,
			messages: existing?.messages ?? [],
			isLoading: false,
			sessionId: payload.sessionId,
			sessionStatus: "active",
		});

		// Also update workflow's currentSessionId
		const workflows = state.workflows.map((w) =>
			w.id === payload.contextId
				? { ...w, currentSessionId: payload.sessionId }
				: w,
		);

		return { conversations, workflows };
	});
}

function handleSessionCompleted(
	sessionId: string,
	set: SetState,
	get: GetState,
): void {
	const workflowId = findWorkflowBySession(sessionId, get);
	if (!workflowId) return;

	set((state) => {
		const conversations = new Map(state.conversations);
		const existing = conversations.get(workflowId);
		if (existing) {
			conversations.set(workflowId, {
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
	get: GetState,
): void {
	const workflowId = findWorkflowBySession(sessionId, get);
	if (!workflowId) return;

	set((state) => {
		const conversations = new Map(state.conversations);
		const existing = conversations.get(workflowId);
		if (existing) {
			conversations.set(workflowId, {
				...existing,
				sessionStatus: "error",
				error,
				streamingMessage: undefined,
			});
		}
		return { conversations };
	});
}

function handleTurnStarted(
	payload: TurnStartedPayload,
	set: SetState,
	get: GetState,
): void {
	const workflowId = findWorkflowBySession(payload.sessionId, get);
	if (!workflowId) return;

	// Only create streaming state for assistant turns
	if (payload.role !== "assistant") return;

	set((state) => {
		const conversations = new Map(state.conversations);
		const existing = conversations.get(workflowId);
		if (existing) {
			conversations.set(workflowId, {
				...existing,
				streamingMessage: {
					turnId: payload.turnId,
					role: payload.role,
					segments: [{ index: 0, content: "", isComplete: false }],
					activeSegmentIndex: 0,
					thought: "",
					tools: [],
					questions: [],
					isComplete: false,
				},
			});
		}
		return { conversations };
	});
}

function handleTurnCompleted(
	payload: TurnCompletedPayload,
	set: SetState,
	get: GetState,
): void {
	const workflowId = findWorkflowBySession(payload.sessionId, get);
	if (!workflowId) return;

	set((state) => {
		const conversations = new Map(state.conversations);
		const existing = conversations.get(workflowId);
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
			};

			conversations.set(workflowId, {
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
	get: GetState,
): void {
	const workflowId = findWorkflowBySession(payload.sessionId, get);
	if (!workflowId) return;

	const segmentIndex = payload.segmentIndex ?? 0;

	set((state) => {
		const conversations = new Map(state.conversations);
		const existing = conversations.get(workflowId);
		if (existing?.streamingMessage?.turnId === payload.turnId) {
			// Get or create the segment at the given index
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

			conversations.set(workflowId, {
				...existing,
				streamingMessage: {
					...existing.streamingMessage,
					segments,
					activeSegmentIndex: segmentIndex,
				},
			});
		}
		return { conversations };
	});
}

function handleSegmentComplete(
	payload: TurnSegmentCompletePayload,
	set: SetState,
	get: GetState,
): void {
	const workflowId = findWorkflowBySession(payload.sessionId, get);
	if (!workflowId) return;

	set((state) => {
		const conversations = new Map(state.conversations);
		const existing = conversations.get(workflowId);
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

			conversations.set(workflowId, {
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
	get: GetState,
): void {
	const workflowId = findWorkflowBySession(payload.sessionId, get);
	if (!workflowId) return;

	set((state) => {
		const conversations = new Map(state.conversations);
		const existing = conversations.get(workflowId);
		if (existing?.streamingMessage?.turnId === payload.turnId) {
			conversations.set(workflowId, {
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
	get: GetState,
): void {
	const workflowId = findWorkflowBySession(payload.sessionId, get);
	if (!workflowId) return;

	set((state) => {
		const conversations = new Map(state.conversations);
		const existing = conversations.get(workflowId);
		if (existing?.streamingMessage?.turnId === payload.turnId) {
			conversations.set(workflowId, {
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
	get: GetState,
): void {
	const workflowId = findWorkflowBySession(payload.sessionId, get);
	if (!workflowId) return;

	set((state) => {
		const conversations = new Map(state.conversations);
		const existing = conversations.get(workflowId);
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
			conversations.set(workflowId, {
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
	get: GetState,
): void {
	const workflowId = findWorkflowBySession(payload.sessionId, get);
	if (!workflowId) return;

	set((state) => {
		const conversations = new Map(state.conversations);
		const existing = conversations.get(workflowId);
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

			conversations.set(workflowId, {
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

				conversations.set(workflowId, {
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
	get: GetState,
): void {
	const workflowId = findWorkflowBySession(payload.sessionId, get);
	if (!workflowId) return;

	set((state) => {
		const conversations = new Map(state.conversations);
		const existing = conversations.get(workflowId);
		if (!existing) return { conversations };

		// Update question in streaming message if present
		if (existing.streamingMessage?.turnId === payload.turnId) {
			const questions = existing.streamingMessage.questions.map((q) =>
				q.id === payload.questionId
					? { ...q, answer: payload.answer, status: "answered" as const }
					: q,
			);

			conversations.set(workflowId, {
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

			conversations.set(workflowId, {
				...existing,
				messages,
			});
		}

		return { conversations };
	});
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Find the workflow ID that a session belongs to
 */
function findWorkflowBySession(
	sessionId: string,
	get: GetState,
): string | undefined {
	const { conversations, workflows } = get();

	// First check conversations map
	for (const [workflowId, conversation] of conversations) {
		if (conversation.sessionId === sessionId) {
			return workflowId;
		}
	}

	// Also check workflows for currentSessionId
	const workflow = workflows.find((w) => w.currentSessionId === sessionId);
	return workflow?.id;
}
