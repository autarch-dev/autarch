/**
 * Discussions Store
 *
 * Zustand store for managing discussion channels and their conversations.
 * Handles channel CRUD, message history, and real-time streaming updates.
 */

import { create } from "zustand";
import type {
	Channel,
	ChannelHistoryResponse,
	ChannelMessage,
	MessageQuestion,
} from "@/shared/schemas/channel";
import type {
	ChannelCreatedPayload,
	ChannelDeletedPayload,
	QuestionsAnsweredPayload,
	QuestionsAskedPayload,
	QuestionsSubmittedPayload,
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
}

/** Per-channel conversation state */
export interface ChannelConversationState {
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

interface DiscussionsState {
	// Channel list
	channels: Channel[];
	channelsLoading: boolean;
	channelsError: string | null;

	// Per-channel conversation state
	conversations: Map<string, ChannelConversationState>;

	// Selected channel
	selectedChannelId: string | null;

	// Actions - Channel CRUD
	fetchChannels: () => Promise<void>;
	createChannel: (name: string, description?: string) => Promise<Channel>;
	deleteChannel: (channelId: string) => Promise<void>;
	selectChannel: (channelId: string | null) => void;

	// Actions - Conversation
	fetchHistory: (channelId: string) => Promise<void>;
	sendMessage: (channelId: string, content: string) => Promise<void>;

	// Actions - WebSocket event handling
	handleWebSocketEvent: (event: WebSocketEvent) => void;

	// Getters
	getChannel: (channelId: string) => Channel | undefined;
	getConversation: (channelId: string) => ChannelConversationState | undefined;
	getSelectedConversation: () => ChannelConversationState | undefined;
}

// =============================================================================
// Store
// =============================================================================

export const useDiscussionsStore = create<DiscussionsState>((set, get) => ({
	// Initial state
	channels: [],
	channelsLoading: false,
	channelsError: null,
	conversations: new Map(),
	selectedChannelId: null,

	// ===========================================================================
	// Channel CRUD
	// ===========================================================================

	fetchChannels: async () => {
		set({ channelsLoading: true, channelsError: null });
		try {
			const response = await fetch("/api/channels");
			if (!response.ok) {
				throw new Error("Failed to fetch channels");
			}
			const channels: Channel[] = await response.json();
			set({ channels, channelsLoading: false });
		} catch (error) {
			set({
				channelsError: error instanceof Error ? error.message : "Unknown error",
				channelsLoading: false,
			});
		}
	},

	createChannel: async (name: string, description?: string) => {
		const response = await fetch("/api/channels", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name, description }),
		});

		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error ?? "Failed to create channel");
		}

		const channel: Channel = await response.json();

		// Add to local state (will also receive WebSocket event)
		set((state) => ({
			channels: [...state.channels, channel],
		}));

		return channel;
	},

	deleteChannel: async (channelId: string) => {
		const response = await fetch(`/api/channels/${channelId}`, {
			method: "DELETE",
		});

		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error ?? "Failed to delete channel");
		}

		// Remove from local state (will also receive WebSocket event)
		set((state) => ({
			channels: state.channels.filter((c) => c.id !== channelId),
			selectedChannelId:
				state.selectedChannelId === channelId ? null : state.selectedChannelId,
		}));
	},

	selectChannel: (channelId: string | null) => {
		set({ selectedChannelId: channelId });
	},

	// ===========================================================================
	// Conversation Management
	// ===========================================================================

	fetchHistory: async (channelId: string) => {
		// Mark as loading
		set((state) => {
			const conversations = new Map(state.conversations);
			const existing = conversations.get(channelId) ?? {
				messages: [],
				isLoading: true,
			};
			conversations.set(channelId, { ...existing, isLoading: true });
			return { conversations };
		});

		try {
			const response = await fetch(`/api/channels/${channelId}/history`);
			if (!response.ok) {
				throw new Error("Failed to fetch history");
			}

			const history: ChannelHistoryResponse = await response.json();

			set((state) => {
				const conversations = new Map(state.conversations);
				conversations.set(channelId, {
					sessionId: history.sessionId,
					sessionStatus: history.sessionStatus,
					messages: history.messages,
					isLoading: false,
				});
				return { conversations };
			});
		} catch (error) {
			set((state) => {
				const conversations = new Map(state.conversations);
				const existing = conversations.get(channelId);
				conversations.set(channelId, {
					...existing,
					messages: existing?.messages ?? [],
					isLoading: false,
					error: error instanceof Error ? error.message : "Unknown error",
				});
				return { conversations };
			});
		}
	},

	sendMessage: async (channelId: string, content: string) => {
		const state = get();
		let sessionId = state.conversations.get(channelId)?.sessionId;

		// Start a session if needed
		if (!sessionId) {
			const response = await fetch(`/api/channels/${channelId}/session`, {
				method: "POST",
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error ?? "Failed to start session");
			}

			const { sessionId: newSessionId } = await response.json();
			sessionId = newSessionId;

			// Update session in state
			set((state) => {
				const conversations = new Map(state.conversations);
				const existing = conversations.get(channelId);
				conversations.set(channelId, {
					...existing,
					messages: existing?.messages ?? [],
					isLoading: false,
					sessionId: newSessionId,
					sessionStatus: "active",
				});
				return { conversations };
			});
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
			const existing = conversations.get(channelId);
			conversations.set(channelId, {
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

			// If session not found (e.g., server restarted), clear it and retry
			if (response.status === 404) {
				set((state) => {
					const conversations = new Map(state.conversations);
					const existing = conversations.get(channelId);
					if (existing) {
						conversations.set(channelId, {
							...existing,
							sessionId: undefined,
							sessionStatus: undefined,
						});
					}
					return { conversations };
				});

				// Retry - this will start a fresh session
				return get().sendMessage(channelId, content);
			}

			throw new Error(error.error ?? "Failed to send message");
		}
	},

	// ===========================================================================
	// WebSocket Event Handling
	// ===========================================================================

	handleWebSocketEvent: (event: WebSocketEvent) => {
		switch (event.type) {
			// Channel events
			case "channel:created":
				handleChannelCreated(event.payload, set, get);
				break;
			case "channel:deleted":
				handleChannelDeleted(event.payload, set, get);
				break;

			// Session events for channels
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
		}
	},

	// ===========================================================================
	// Getters
	// ===========================================================================

	getChannel: (channelId: string) => {
		return get().channels.find((c) => c.id === channelId);
	},

	getConversation: (channelId: string) => {
		return get().conversations.get(channelId);
	},

	getSelectedConversation: () => {
		const { selectedChannelId, conversations } = get();
		if (!selectedChannelId) return undefined;
		return conversations.get(selectedChannelId);
	},
}));

// =============================================================================
// Event Handlers
// =============================================================================

type SetState = (
	fn: (state: DiscussionsState) => Partial<DiscussionsState>,
) => void;
type GetState = () => DiscussionsState;

function handleChannelCreated(
	payload: ChannelCreatedPayload,
	set: SetState,
	_get: GetState,
): void {
	set((state) => {
		// Check if already exists (from optimistic update)
		if (state.channels.some((c) => c.id === payload.channelId)) {
			return {};
		}

		const newChannel: Channel = {
			id: payload.channelId,
			name: payload.name,
			description: payload.description,
			createdAt: Date.now(),
			updatedAt: Date.now(),
		};

		return {
			channels: [...state.channels, newChannel],
		};
	});
}

function handleChannelDeleted(
	payload: ChannelDeletedPayload,
	set: SetState,
	_get: GetState,
): void {
	set((state) => ({
		channels: state.channels.filter((c) => c.id !== payload.channelId),
		selectedChannelId:
			state.selectedChannelId === payload.channelId
				? null
				: state.selectedChannelId,
	}));
}

function handleSessionStarted(
	payload: SessionStartedPayload,
	set: SetState,
	_get: GetState,
): void {
	if (payload.contextType !== "channel") return;

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
		return { conversations };
	});
}

function handleSessionCompleted(
	sessionId: string,
	set: SetState,
	get: GetState,
): void {
	const channelId = findChannelBySession(sessionId, get);
	if (!channelId) return;

	set((state) => {
		const conversations = new Map(state.conversations);
		const existing = conversations.get(channelId);
		if (existing) {
			conversations.set(channelId, {
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
	const channelId = findChannelBySession(sessionId, get);
	if (!channelId) return;

	set((state) => {
		const conversations = new Map(state.conversations);
		const existing = conversations.get(channelId);
		if (existing) {
			conversations.set(channelId, {
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
	const channelId = findChannelBySession(payload.sessionId, get);
	if (!channelId) return;

	// Only create streaming state for assistant turns
	if (payload.role !== "assistant") return;

	set((state) => {
		const conversations = new Map(state.conversations);
		const existing = conversations.get(channelId);
		if (existing) {
			conversations.set(channelId, {
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
	const channelId = findChannelBySession(payload.sessionId, get);
	if (!channelId) return;

	set((state) => {
		const conversations = new Map(state.conversations);
		const existing = conversations.get(channelId);
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

			conversations.set(channelId, {
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
	const channelId = findChannelBySession(payload.sessionId, get);
	if (!channelId) return;

	const segmentIndex = payload.segmentIndex ?? 0;

	set((state) => {
		const conversations = new Map(state.conversations);
		const existing = conversations.get(channelId);
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

			conversations.set(channelId, {
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
	const channelId = findChannelBySession(payload.sessionId, get);
	if (!channelId) return;

	set((state) => {
		const conversations = new Map(state.conversations);
		const existing = conversations.get(channelId);
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

			conversations.set(channelId, {
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
	const channelId = findChannelBySession(payload.sessionId, get);
	if (!channelId) return;

	set((state) => {
		const conversations = new Map(state.conversations);
		const existing = conversations.get(channelId);
		if (existing?.streamingMessage?.turnId === payload.turnId) {
			conversations.set(channelId, {
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
	const channelId = findChannelBySession(payload.sessionId, get);
	if (!channelId) return;

	set((state) => {
		const conversations = new Map(state.conversations);
		const existing = conversations.get(channelId);
		if (existing?.streamingMessage?.turnId === payload.turnId) {
			conversations.set(channelId, {
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
	const channelId = findChannelBySession(payload.sessionId, get);
	if (!channelId) return;

	set((state) => {
		const conversations = new Map(state.conversations);
		const existing = conversations.get(channelId);
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
			conversations.set(channelId, {
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
	const channelId = findChannelBySession(payload.sessionId, get);
	if (!channelId) return;

	set((state) => {
		const conversations = new Map(state.conversations);
		const existing = conversations.get(channelId);
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

			conversations.set(channelId, {
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

				conversations.set(channelId, {
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
	const channelId = findChannelBySession(payload.sessionId, get);
	if (!channelId) return;

	set((state) => {
		const conversations = new Map(state.conversations);
		const existing = conversations.get(channelId);
		if (!existing) return { conversations };

		// Update question in streaming message if present
		if (existing.streamingMessage?.turnId === payload.turnId) {
			const questions = existing.streamingMessage.questions.map((q) =>
				q.id === payload.questionId
					? { ...q, answer: payload.answer, status: "answered" as const }
					: q,
			);

			conversations.set(channelId, {
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

			conversations.set(channelId, {
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
	get: GetState,
): void {
	const channelId = findChannelBySession(payload.sessionId, get);
	if (!channelId) return;

	set((state) => {
		const conversations = new Map(state.conversations);
		const existing = conversations.get(channelId);
		if (!existing) return { conversations };

		// Update questionsComment in streaming message if present
		if (existing.streamingMessage?.turnId === payload.turnId) {
			conversations.set(channelId, {
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

			conversations.set(channelId, {
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
 * Find the channel ID that a session belongs to
 */
function findChannelBySession(
	sessionId: string,
	get: GetState,
): string | undefined {
	const { conversations } = get();
	for (const [channelId, conversation] of conversations) {
		if (conversation.sessionId === sessionId) {
			return channelId;
		}
	}
	return undefined;
}
