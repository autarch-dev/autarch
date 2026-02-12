/**
 * Credential Prompt Service
 *
 * Manages GIT_ASKPASS / SSH_ASKPASS credential prompts for git operations.
 * Creates ephemeral helper scripts that POST credential requests to the local
 * server, which long-polls until the user provides input or a timeout occurs.
 *
 * Uses the same blocking promise pattern as the shell approval service.
 */

import { chmod, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { log } from "@/backend/logger";
import { broadcast } from "@/backend/ws";
import {
	createCredentialPromptNeededEvent,
	createCredentialPromptResolvedEvent,
} from "@/shared/schemas/events";

// =============================================================================
// Types
// =============================================================================

/**
 * A pending credential prompt waiting for user input
 */
export interface PendingCredentialPrompt {
	promptId: string;
	prompt: string;
	resolve: (credential: string | null) => void;
	timer: ReturnType<typeof setTimeout>;
}

/**
 * Context for a GIT_ASKPASS helper script tied to a single git command
 */
export interface AskpassContext {
	nonce: string;
	scriptPath: string;
	cleanup: () => Promise<void>;
}

// =============================================================================
// State
// =============================================================================

/** Pending credential prompts waiting for user input, keyed by promptId */
const pendingPrompts = new Map<string, PendingCredentialPrompt>();

/** Active nonces for currently-running git commands */
const activeNonces = new Set<string>();

// =============================================================================
// Public API
// =============================================================================

/**
 * Create a GIT_ASKPASS context for a git command.
 * Generates a nonce-secured ephemeral helper script that POSTs credential
 * requests to the local server.
 *
 * @param serverPort - The local server port to target
 * @returns Context with nonce, script path, and cleanup function
 */
export async function createAskpassContext(
	serverPort: number,
): Promise<AskpassContext> {
	const nonce = crypto.randomUUID();
	activeNonces.add(nonce);

	const platform = process.platform;
	let scriptPath: string;

	if (platform === "win32") {
		scriptPath = join(tmpdir(), `autarch-askpass-${nonce}.cmd`);
		const script = [
			"@echo off",
			`powershell -Command "$r = Invoke-WebRequest -Uri 'http://127.0.0.1:${serverPort}/api/credential-prompt' -Method POST -Headers @{'X-Askpass-Nonce'='${nonce}';'Content-Type'='text/plain'} -Body $args[0] -UseBasicParsing; $r.Content"`,
		].join("\r\n");
		await writeFile(scriptPath, script, "utf-8");
	} else {
		scriptPath = join(tmpdir(), `autarch-askpass-${nonce}.sh`);
		const script = [
			"#!/bin/sh",
			`CREDENTIAL=$(curl -s -X POST -H 'Content-Type: text/plain' -H 'X-Askpass-Nonce: ${nonce}' --data-binary "$1" http://127.0.0.1:${serverPort}/api/credential-prompt)`,
			`if [ -z "$CREDENTIAL" ]; then exit 1; fi`,
			`printf '%s' "$CREDENTIAL"`,
		].join("\n");
		await writeFile(scriptPath, script, "utf-8");
		await chmod(scriptPath, 0o700);
	}

	log.git.info(`Created askpass script: ${scriptPath} (nonce: ${nonce})`);

	const cleanup = async () => {
		activeNonces.delete(nonce);
		try {
			await unlink(scriptPath);
		} catch (err: unknown) {
			if (
				err instanceof Error &&
				"code" in err &&
				(err as NodeJS.ErrnoException).code === "ENOENT"
			) {
				// File already deleted, ignore
			} else {
				throw err;
			}
		}
		log.git.debug(`Cleaned up askpass script: ${scriptPath}`);
	};

	return { nonce, scriptPath, cleanup };
}

/**
 * Request a credential from the user.
 * Returns a Promise that resolves when the user provides input or timeout occurs.
 *
 * This is the long-poll handler — the askpass script's HTTP request blocks
 * until this promise resolves.
 *
 * @param nonce - The askpass nonce to validate
 * @param prompt - The credential prompt text from git
 * @returns The credential string, or null if cancelled/timed out
 */
export function requestCredential(
	nonce: string,
	prompt: string,
): Promise<string | null> {
	if (!activeNonces.has(nonce)) {
		throw new Error("Invalid or expired nonce");
	}

	const promptId = crypto.randomUUID();

	log.git.info(
		`Credential prompt requested: "${prompt}" (promptId: ${promptId})`,
	);

	return new Promise<string | null>((resolve) => {
		const timer = setTimeout(() => {
			log.git.warn(`Credential prompt timed out: ${promptId} ("${prompt}")`);
			pendingPrompts.delete(promptId);
			broadcast(createCredentialPromptResolvedEvent({ promptId }));
			resolve(null);
		}, 60_000);

		pendingPrompts.set(promptId, {
			promptId,
			prompt,
			resolve,
			timer,
		});

		// Broadcast to connected clients so the UI can show the prompt
		const event = createCredentialPromptNeededEvent({ promptId, prompt });
		log.git.info("Broadcasting credential:prompt_needed event");
		broadcast(event);
	});
}

/**
 * Resolve a pending credential prompt (called when user submits or cancels)
 *
 * @param promptId - The prompt ID to resolve
 * @param credential - The credential string, or null if cancelled
 * @returns true if the prompt was found and resolved, false otherwise
 */
export function resolveCredentialPrompt(
	promptId: string,
	credential: string | null,
): boolean {
	const pending = pendingPrompts.get(promptId);

	if (!pending) {
		log.git.warn(`Attempted to resolve unknown credential prompt: ${promptId}`);
		return false;
	}

	log.git.info(
		`Credential prompt resolved: ${promptId} (${credential !== null ? "provided" : "cancelled"})`,
	);

	clearTimeout(pending.timer);
	pending.resolve(credential);
	pendingPrompts.delete(promptId);

	// Broadcast resolution so frontend can update UI state
	broadcast(createCredentialPromptResolvedEvent({ promptId }));

	return true;
}

/**
 * Get all pending credential prompts (for re-broadcasting on client reconnect)
 *
 * @returns Array of pending prompt info
 */
export function getAllPendingPrompts(): Array<{
	promptId: string;
	prompt: string;
}> {
	return Array.from(pendingPrompts.values()).map(({ promptId, prompt }) => ({
		promptId,
		prompt,
	}));
}
