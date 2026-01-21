/**
 * Shell Approval Service
 *
 * Manages user approval for shell commands before execution.
 * Uses a blocking promise pattern - requestApproval() returns a Promise
 * that resolves when the user approves/denies via the API.
 */

import { log } from "@/backend/logger";
import { broadcast } from "@/backend/ws";
import {
	createShellApprovalNeededEvent,
	createShellApprovalResolvedEvent,
} from "@/shared/schemas/events";

// =============================================================================
// Types
// =============================================================================

/**
 * Result of an approval decision
 */
export interface ApprovalResult {
	approved: boolean;
	remember: boolean;
	/** Reason for denial (only present when approved is false) */
	denyReason?: string;
}

/**
 * A pending approval waiting for user decision
 */
export interface PendingApproval {
	workflowId: string;
	sessionId: string;
	turnId: string;
	toolId: string;
	command: string;
	reason: string;
	resolve: (result: ApprovalResult) => void;
	reject: (error: Error) => void;
}

/**
 * Parameters for requesting approval
 */
export interface RequestApprovalParams {
	workflowId: string;
	sessionId: string;
	turnId: string;
	toolId: string;
	command: string;
	reason: string;
}

// =============================================================================
// State
// =============================================================================

/** Pending approvals waiting for user decision, keyed by approvalId */
const pendingApprovals = new Map<string, PendingApproval>();

/** Commands that have been approved with "remember" for each workflow */
const rememberedCommands = new Map<string, Set<string>>();

// =============================================================================
// Public API
// =============================================================================

/**
 * Check if a command has been remembered (auto-approved) for a workflow
 */
export function isCommandRemembered(
	workflowId: string,
	command: string,
): boolean {
	const commands = rememberedCommands.get(workflowId);
	return commands?.has(command) ?? false;
}

/**
 * Request approval for a shell command.
 * Returns a Promise that resolves when the user approves or rejects when denied.
 *
 * @param params - The approval request parameters
 * @returns Promise that resolves with the approval result
 */
export function requestApproval(
	params: RequestApprovalParams,
): Promise<ApprovalResult> {
	const approvalId = crypto.randomUUID();

	log.agent.info(
		`Shell approval requested: ${params.command} (approvalId: ${approvalId})`,
	);

	return new Promise<ApprovalResult>((resolve, reject) => {
		// Store the pending approval with resolve/reject handlers
		pendingApprovals.set(approvalId, {
			workflowId: params.workflowId,
			sessionId: params.sessionId,
			turnId: params.turnId,
			toolId: params.toolId,
			command: params.command,
			reason: params.reason,
			resolve,
			reject,
		});

		// Broadcast the approval_needed event to connected clients
		broadcast(
			createShellApprovalNeededEvent({
				approvalId,
				workflowId: params.workflowId,
				sessionId: params.sessionId,
				turnId: params.turnId,
				toolId: params.toolId,
				command: params.command,
				reason: params.reason,
			}),
		);
	});
}

/**
 * Resolve a pending approval (called when user approves or denies)
 *
 * @param approvalId - The approval ID to resolve
 * @param approved - Whether the command was approved
 * @param remember - Whether to remember this approval for the workflow
 * @param denyReason - Optional reason for denial (used in error message)
 */
export function resolveApproval(
	approvalId: string,
	approved: boolean,
	remember: boolean,
	denyReason?: string,
): void {
	const pending = pendingApprovals.get(approvalId);

	if (!pending) {
		log.agent.warn(`Attempted to resolve unknown approval: ${approvalId}`);
		return;
	}

	log.agent.info(
		`Shell approval resolved: ${pending.command} - ${approved ? "approved" : "denied"}${remember ? " (remembered)" : ""}`,
	);

	// If approved and remember is set, add to remembered commands
	if (approved && remember) {
		let commands = rememberedCommands.get(pending.workflowId);
		if (!commands) {
			commands = new Set();
			rememberedCommands.set(pending.workflowId, commands);
		}
		commands.add(pending.command);
	}

	// Resolve the promise (denial is resolved with approved: false, not rejected)
	if (approved) {
		pending.resolve({ approved: true, remember });
	} else {
		pending.resolve({ approved: false, remember: false, denyReason });
	}

	// Broadcast the resolution event so frontend can update UI state
	broadcast(
		createShellApprovalResolvedEvent({
			approvalId,
			approved,
			remember,
		}),
	);

	// Clean up
	pendingApprovals.delete(approvalId);
}

/**
 * Clean up all pending approvals for a session (called when session ends)
 *
 * Resolves pending promises with approved: false (consistent with resolveApproval denial pattern)
 * rather than rejecting them, so callers don't need special error handling.
 *
 * @param sessionId - The session ID to clean up
 */
export function cleanupSession(sessionId: string): void {
	const toRemove: string[] = [];

	for (const [approvalId, pending] of pendingApprovals) {
		if (pending.sessionId === sessionId) {
			log.agent.info(
				`Cleaning up pending approval for ended session: ${approvalId}`,
			);
			// Use resolve with approved: false (consistent with resolveApproval denial pattern)
			// This avoids requiring special error handling in callers
			pending.resolve({
				approved: false,
				remember: false,
				denyReason: "Session ended",
			});
			toRemove.push(approvalId);
		}
	}

	for (const approvalId of toRemove) {
		pendingApprovals.delete(approvalId);
	}
}

/**
 * Clean up remembered commands for a workflow (called when workflow completes)
 *
 * @param workflowId - The workflow ID to clean up
 */
export function cleanupWorkflow(workflowId: string): void {
	rememberedCommands.delete(workflowId);
}

/**
 * Get a pending approval by ID (for testing/debugging)
 */
export function getPendingApproval(
	approvalId: string,
): PendingApproval | undefined {
	return pendingApprovals.get(approvalId);
}

/**
 * Get the count of pending approvals (for testing/debugging)
 */
export function getPendingApprovalCount(): number {
	return pendingApprovals.size;
}

// =============================================================================
// Singleton Export
// =============================================================================

export const shellApprovalService = {
	isCommandRemembered,
	requestApproval,
	resolveApproval,
	cleanupSession,
	cleanupWorkflow,
	getPendingApproval,
	getPendingApprovalCount,
};
