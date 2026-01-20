/**
 * Embedding provider - Communicates with the embed CLI process.
 *
 * The CLI runs as a persistent process, reading JSON requests from stdin
 * and writing JSON responses to stdout. This avoids model loading overhead
 * for each embedding request.
 */

import type { Subprocess } from "bun";
import { log } from "@/backend/logger";
import { getEmbedPath, isEmbeddingSupported } from "../embed";

// =============================================================================
// Configuration
// =============================================================================

/** Model produces 768-dimensional vectors */
export const EMBEDDING_DIMENSIONS = 768;

/** Model supports up to 8192 tokens */
export const MAX_TOKENS = 8192;

// =============================================================================
// Types
// =============================================================================

interface EmbedRequest {
	id: number;
	text: string;
}

interface EmbedResponse {
	id: number;
	embedding?: number[];
	error?: string;
}

interface PendingRequest {
	resolve: (embedding: Float32Array) => void;
	reject: (error: Error) => void;
}

// =============================================================================
// Process Management
// =============================================================================

let proc: Subprocess<"pipe", "pipe", "pipe"> | null = null;
let initPromise: Promise<boolean> | null = null;
let requestId = 0;

/** Pending requests waiting for responses, keyed by request ID */
const pendingRequests = new Map<number, PendingRequest>();

/**
 * Read lines from a ReadableStream and call the handler for each line.
 */
async function readLines(
	stream: ReadableStream<Uint8Array>,
	onLine: (line: string) => void,
): Promise<void> {
	const reader = stream.getReader();
	const decoder = new TextDecoder();
	let buffer = "";

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			buffer += decoder.decode(value, { stream: true });

			// Process complete lines
			const lines = buffer.split("\n");
			buffer = lines.pop() ?? ""; // Keep incomplete line in buffer

			for (const line of lines) {
				if (line.trim()) {
					onLine(line);
				}
			}
		}

		// Process any remaining data
		if (buffer.trim()) {
			onLine(buffer);
		}
	} finally {
		reader.releaseLock();
	}
}

/**
 * Initialize the embed CLI process.
 * Returns true if successful, false if embeddings are unavailable.
 */
async function initProcess(): Promise<boolean> {
	if (!isEmbeddingSupported()) {
		log.embedding.warn("Platform not supported, embeddings disabled");
		return false;
	}

	const embedPath = await getEmbedPath();
	if (!embedPath) {
		log.embedding.warn("Embed CLI not available, embeddings disabled");
		return false;
	}

	log.embedding.info("Starting embed CLI process...");

	const spawnedProc = Bun.spawn([embedPath], {
		stdin: "pipe",
		stdout: "pipe",
		stderr: "pipe",
	});
	proc = spawnedProc;

	// Start reading stdout for responses (runs in background)
	readLines(spawnedProc.stdout, (line) => {
		try {
			const response: EmbedResponse = JSON.parse(line);
			const pending = pendingRequests.get(response.id);

			if (pending) {
				pendingRequests.delete(response.id);

				if (response.error) {
					pending.reject(new Error(response.error));
				} else if (response.embedding) {
					pending.resolve(new Float32Array(response.embedding));
				} else {
					pending.reject(new Error("Invalid response from embed CLI"));
				}
			}
		} catch (err) {
			log.embedding.error("Failed to parse embed response:", err);
		}
	});

	// Wait for "ready" signal on stderr. Buffer stderr lines so we can
	// include them in failure logs if startup fails.
	const startupStderr: string[] = [];
	try {
		await new Promise<void>((resolve, reject) => {
			const timeout = setTimeout(() => {
				reject(new Error("Embed CLI failed to start (timeout)"));
			}, 60000); // 60 second timeout for model loading

			// Read stderr for ready signal and logging
			readLines(spawnedProc.stderr, (line) => {
				if (line === "ready") {
					clearTimeout(timeout);
					resolve();
				} else {
					// Buffer and also debug-log other stderr output
					startupStderr.push(line);
					log.embedding.debug(`[embed] ${line}`);
				}
			});

			// Handle process exit during startup
			spawnedProc.exited.then((code) => {
				if (code !== 0) {
					clearTimeout(timeout);
					reject(new Error(`Embed CLI exited with code ${code}`));
				}
			});
		});
	} catch (err) {
		// Log a clear error and include any buffered stderr to help debugging
		try {
			log.embedding.error("Embed CLI failed to start:", err);
			if (startupStderr.length > 0) {
				log.embedding.error(
					`Embed startup stderr:\n${startupStderr.join("\n")}`,
				);
			}
		} catch (e) {
			// Swallow logging errors
		}

		// Attempt to clean up the subprocess and reset init state so callers
		// can retry later.
		try {
			spawnedProc.stdin?.end();
		} catch (e) {
			/* ignore */
		}
		proc = null;
		initPromise = null;
		// Re-throw to allow callers to handle if needed
		throw err;
	}

	log.embedding.success("Embed CLI ready");
	return true;
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Check if embeddings are available on this platform.
 */
export { isEmbeddingSupported as isEmbeddingAvailable } from "../embed";

/**
 * Initialize the embedding service.
 * Returns true if embeddings are available, false otherwise.
 */
export async function initEmbed(): Promise<boolean> {
	if (proc) {
		return true;
	}

	if (!initPromise) {
		initPromise = initProcess();
	}

	return initPromise;
}

/**
 * Generate an embedding vector for a single text input.
 *
 * @param text - The text to embed
 * @returns A Float32Array of length 768
 * @throws Error if embeddings are not available or the request fails
 */
export async function embed(text: string): Promise<Float32Array> {
	const available = await initEmbed();
	if (!available || !proc) {
		throw new Error("Embeddings not available on this platform");
	}

	// Capture proc reference for use in callback
	const currentProc = proc;

	const id = ++requestId;
	const request: EmbedRequest = { id, text };

	return new Promise((resolve, reject) => {
		pendingRequests.set(id, { resolve, reject });

		const json = `${JSON.stringify(request)}\n`;
		currentProc.stdin.write(json);
	});
}

/**
 * Generate embedding vectors for multiple texts in a batch.
 *
 * @param texts - Array of texts to embed
 * @returns Array of Float32Arrays, each of length 768
 */
export async function embedBatch(texts: string[]): Promise<Float32Array[]> {
	if (texts.length === 0) {
		return [];
	}

	// Fire all requests concurrently
	return Promise.all(texts.map((text) => embed(text)));
}

/**
 * Preload the embedding model.
 * Call this at startup to avoid latency on first embed call.
 */
export async function preloadModel(): Promise<void> {
	await initEmbed();
}

/**
 * Terminate the embed CLI process.
 */
export function terminateEmbed(): void {
	if (proc) {
		// Close stdin to signal graceful shutdown
		proc.stdin.end();
		proc = null;
		initPromise = null;
		pendingRequests.clear();
		log.embedding.info("Embed CLI terminated");
	}
}

// Legacy alias for backwards compatibility
export const terminateWorker = terminateEmbed;
