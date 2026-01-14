import type { ServerWebSocket } from "bun";
import type { WebSocketEvent } from "@/shared/schemas/events";

// =============================================================================
// WebSocket Connection Management
// =============================================================================

const clients = new Set<ServerWebSocket<unknown>>();

/**
 * Handle new WebSocket connection
 */
export function handleOpen(ws: ServerWebSocket<unknown>): void {
	clients.add(ws);
}

/**
 * Handle WebSocket message (currently unused, but available for bidirectional communication)
 */
export function handleMessage(
	_ws: ServerWebSocket<unknown>,
	_message: string | Buffer,
): void {
	// Reserved for future client-to-server messages
}

/**
 * Handle WebSocket close
 */
export function handleClose(ws: ServerWebSocket<unknown>): void {
	clients.delete(ws);
}

/**
 * Broadcast a typed event to all connected clients
 */
export function broadcast(event: WebSocketEvent): void {
	const message = JSON.stringify(event);
	for (const client of clients) {
		client.send(message);
	}
}

/**
 * Get the number of connected clients
 */
export function getClientCount(): number {
	return clients.size;
}
