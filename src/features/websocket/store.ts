import { create } from "zustand";
import {
	type IndexingProgressPayload,
	type WebSocketEvent,
	WebSocketEventSchema,
} from "@/shared/schemas/events";

// =============================================================================
// Store State
// =============================================================================

interface WebSocketState {
	// Connection state
	connected: boolean;
	error: string | null;

	// Event-specific state slices
	indexingProgress: IndexingProgressPayload | null;

	// Actions
	connect: () => void;
	disconnect: () => void;
}

// =============================================================================
// WebSocket Instance
// =============================================================================

let ws: WebSocket | null = null;

// =============================================================================
// Store
// =============================================================================

export const useWebSocketStore = create<WebSocketState>((set) => ({
	connected: false,
	error: null,
	indexingProgress: null,

	connect: () => {
		// Already connected or connecting
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

				handleEvent(parsed.data, set);
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
}));

// =============================================================================
// Event Handlers
// =============================================================================

function handleEvent(
	event: WebSocketEvent,
	set: (state: Partial<WebSocketState>) => void,
): void {
	switch (event.type) {
		case "indexing:progress":
			set({ indexingProgress: event.payload });
			break;
	}
}
