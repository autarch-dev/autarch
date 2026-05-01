/**
 * Shell Approval Service
 *
 * Manages user approval for shell commands before execution.
 * Uses a blocking promise pattern - requestApproval() returns a Promise
 * that resolves when the user approves/denies via the API.
 */

import { log } from "@/backend/logger";
import {
	addPersistentShellApproval,
	getPersistentShellApprovals,
	getShellApprovalMode,
} from "@/backend/services/projectSettings";
import { broadcast } from "@/backend/ws";
import {
	createShellApprovalNeededEvent,
	createShellApprovalResolvedEvent,
	createShellAutoApprovedEvent,
} from "@/shared/schemas/events";
import { matchHardBlock } from "./hardBlock";
import { runJudge } from "./judge";

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
	/** Human-readable reason when the approval bypassed the manual prompt
	 * (exact match against remembered/persistent commands, judge APPROVE,
	 * or yolo mode). Surfaced inline under the tool call. */
	autoApprovalReason?: string;
}

/**
 * A pending approval waiting for user decision
 */
export interface PendingApproval {
	workflowId: string;
	sessionId: string;
	turnId: string;
	toolCallId: string;
	command: string;
	reason: string;
	agentRole?: string;
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
	toolCallId: string;
	command: string;
	reason: string;
	projectRoot: string;
	agentRole?: string;
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
 * Checks persistent approvals first (project-wide), then workflow-scoped remembered commands.
 *
 * @param params - The approval request parameters
 * @returns Promise that resolves with the approval result
 */
export async function requestApproval(
	params: RequestApprovalParams,
): Promise<ApprovalResult> {
	// Hard-block check runs before any auto-approve path. Catastrophic patterns
	// always force a manual prompt (with a warning label), even if the user has
	// previously remembered the exact command, and even in Yolo mode.
	const hardBlock = matchHardBlock(params.command);
	if (hardBlock.matched) {
		log.agent.warn(
			`Shell command matched hard-block pattern "${hardBlock.label}": ${params.command}`,
		);
		return promptForApproval(params, hardBlock.label);
	}

	// Check persistent approvals first (project-wide, persists across workflows)
	const persistentApprovals = await getPersistentShellApprovals(
		params.projectRoot,
	);
	if (persistentApprovals.includes(params.command)) {
		const reason = "Auto-approved: matches a saved project approval";
		log.agent.info(
			`Shell command auto-approved via persistent approval: ${params.command}`,
		);
		broadcast(
			createShellAutoApprovedEvent({
				workflowId: params.workflowId,
				sessionId: params.sessionId,
				turnId: params.turnId,
				toolCallId: params.toolCallId,
				reason,
			}),
		);
		return {
			approved: true,
			remember: false,
			denyReason: undefined,
			autoApprovalReason: reason,
		};
	}

	// Check workflow-scoped remembered commands
	if (isCommandRemembered(params.workflowId, params.command)) {
		const reason =
			"Auto-approved: matches a remembered command for this session";
		log.agent.info(
			`Shell command auto-approved via workflow remembered: ${params.command}`,
		);
		broadcast(
			createShellAutoApprovedEvent({
				workflowId: params.workflowId,
				sessionId: params.sessionId,
				turnId: params.turnId,
				toolCallId: params.toolCallId,
				reason,
			}),
		);
		return {
			approved: true,
			remember: true,
			denyReason: undefined,
			autoApprovalReason: reason,
		};
	}

	// Mode-based decision (strict / auto / yolo)
	const mode = await getShellApprovalMode(params.projectRoot);

	if (mode === "yolo") {
		const reason = "Auto-approved: yolo mode";
		log.agent.info(
			`Shell command auto-approved via yolo mode: ${params.command}`,
		);
		broadcast(
			createShellAutoApprovedEvent({
				workflowId: params.workflowId,
				sessionId: params.sessionId,
				turnId: params.turnId,
				toolCallId: params.toolCallId,
				reason,
			}),
		);
		return {
			approved: true,
			remember: false,
			denyReason: undefined,
			autoApprovalReason: reason,
		};
	}

	if (mode === "auto") {
		// Merge prior approvals (project-persistent + this workflow's remembered)
		// as positive examples for the judge.
		const workflowRemembered = Array.from(
			rememberedCommands.get(params.workflowId) ?? [],
		);
		const priorApprovals = Array.from(
			new Set([...persistentApprovals, ...workflowRemembered]),
		);

		const verdict = await runJudge({
			command: params.command,
			reason: params.reason,
			agentRole: params.agentRole,
			priorApprovals,
		});

		if (verdict?.verdict === "APPROVE") {
			const reason = `Auto-approved by judge: ${verdict.reasoning}`;
			log.agent.info(
				`Shell command auto-approved by judge: ${params.command} (${verdict.reasoning})`,
			);
			broadcast(
				createShellAutoApprovedEvent({
					workflowId: params.workflowId,
					sessionId: params.sessionId,
					turnId: params.turnId,
					toolCallId: params.toolCallId,
					reason,
				}),
			);
			return {
				approved: true,
				remember: false,
				denyReason: undefined,
				autoApprovalReason: reason,
			};
		}

		// REVIEW (or judge call failed) → manual prompt with judge's reasoning
		// (when present) shown to the user.
		return promptForApproval(params, undefined, verdict?.reasoning);
	}

	// strict → manual prompt
	return promptForApproval(params);
}

/**
 * Broadcast a manual approval prompt and return a Promise that resolves when
 * the user decides. Optionally carries a hard-block warning label and/or the
 * judge's reasoning (when REVIEW kicks back in auto mode), both shown in the
 * approval dialog.
 */
function promptForApproval(
	params: RequestApprovalParams,
	hardBlockLabel?: string,
	judgeReasoning?: string,
): Promise<ApprovalResult> {
	const approvalId = crypto.randomUUID();

	log.agent.info(
		`Shell approval requested: ${params.command} (approvalId: ${approvalId})`,
	);
	log.agent.info(
		`Shell approval context: workflowId=${params.workflowId}, sessionId=${params.sessionId}, turnId=${params.turnId}, toolCallId=${params.toolCallId}`,
	);

	return new Promise<ApprovalResult>((resolve, reject) => {
		// Store the pending approval with resolve/reject handlers
		pendingApprovals.set(approvalId, {
			workflowId: params.workflowId,
			sessionId: params.sessionId,
			turnId: params.turnId,
			toolCallId: params.toolCallId,
			command: params.command,
			reason: params.reason,
			agentRole: params.agentRole,
			resolve,
			reject,
		});

		// Broadcast the approval_needed event to connected clients
		const event = createShellApprovalNeededEvent({
			approvalId,
			workflowId: params.workflowId,
			sessionId: params.sessionId,
			turnId: params.turnId,
			toolCallId: params.toolCallId,
			command: params.command,
			reason: params.reason,
			agentRole: params.agentRole,
			hardBlockLabel,
			judgeReasoning,
		});
		log.agent.info(`Broadcasting shell:approval_needed event`);
		broadcast(event);
	});
}

/**
 * Resolve a pending approval (called when user approves or denies)
 *
 * @param approvalId - The approval ID to resolve
 * @param approved - Whether the command was approved
 * @param remember - Whether to remember this approval for the workflow
 * @param persistForProject - Whether to persist this approval for the entire project
 * @param projectRoot - The project root path (required if persistForProject is true)
 * @param denyReason - Optional reason for denial (used in error message)
 */
export async function resolveApproval(
	approvalId: string,
	approved: boolean,
	remember: boolean,
	persistForProject: boolean,
	projectRoot: string,
	denyReason?: string,
): Promise<void> {
	const pending = pendingApprovals.get(approvalId);

	if (!pending) {
		log.agent.warn(`Attempted to resolve unknown approval: ${approvalId}`);
		return;
	}

	log.agent.info(
		`Shell approval resolved: ${pending.command} - ${approved ? "approved" : "denied"}${remember ? " (remembered)" : ""}${persistForProject ? " (persisted)" : ""}`,
	);

	// If approved and persistForProject is set, add to persistent approvals
	if (approved && persistForProject) {
		await addPersistentShellApproval(projectRoot, pending.command);
	}

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

/**
 * Get all pending approvals (for re-broadcasting on client reconnect)
 * Returns an array of [approvalId, pendingApproval] tuples
 */
export function getAllPendingApprovals(): Array<[string, PendingApproval]> {
	return Array.from(pendingApprovals.entries());
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
	getAllPendingApprovals,
};
