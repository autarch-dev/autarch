import type { ServerWebSocket } from "bun";
import type { WebSocketEvent } from "@/shared/schemas/events";
import {
	createCredentialPromptNeededEvent,
	createShellApprovalNeededEvent,
} from "@/shared/schemas/events";
import { log } from "../logger";
import { getAllPendingPrompts } from "../services/credential-prompt";
import { shellApprovalService } from "../services/shell-approval";

// =============================================================================
// WebSocket Connection Management
// =============================================================================

const clients = new Set<ServerWebSocket<unknown>>();

/**
 * Handle new WebSocket connection
 */
export function handleOpen(ws: ServerWebSocket<unknown>): void {
	clients.add(ws);
	log.ws.info(`Client connected (${clients.size} total)`);

	// Re-send any pending shell approvals to the newly connected client
	const pendingApprovals = shellApprovalService.getAllPendingApprovals();
	for (const [approvalId, pending] of pendingApprovals) {
		const event = createShellApprovalNeededEvent({
			approvalId,
			workflowId: pending.workflowId,
			sessionId: pending.sessionId,
			turnId: pending.turnId,
			toolId: pending.toolId,
			command: pending.command,
			reason: pending.reason,
			agentRole: pending.agentRole,
		});
		ws.send(JSON.stringify(event));
		log.ws.debug(`Re-sent pending shell approval ${approvalId} to new client`);
	}

	// Re-send any pending credential prompts to the newly connected client
	const pendingCredentialPrompts = getAllPendingPrompts();
	for (const { promptId, prompt } of pendingCredentialPrompts) {
		const event = createCredentialPromptNeededEvent({ promptId, prompt });
		ws.send(JSON.stringify(event));
		log.ws.debug(`Re-sent pending credential prompt ${promptId} to new client`);
	}
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
	log.ws.info(`Client disconnected (${clients.size} remaining)`);
}

/**
 * Broadcast a typed event to all connected clients
 */
export function broadcast(event: WebSocketEvent): void {
	if (clients.size === 0) {
		log.ws.debug(`No clients to broadcast ${event.type}`);
		return;
	}

	const message = JSON.stringify(event);
	for (const client of clients) {
		client.send(message);
	}
	log.ws.debug(`Broadcast ${event.type} to ${clients.size} client(s)`);
}

/**
 * Get the number of connected clients
 */
export function getClientCount(): number {
	return clients.size;
}
