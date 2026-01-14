/**
 * Embedding provider - communicates with the embedding worker thread.
 * This keeps the main event loop responsive while embedding runs in the background.
 */

// =============================================================================
// Configuration
// =============================================================================

/** Model produces 768-dimensional vectors */
export const EMBEDDING_DIMENSIONS = 768;

/** Model supports up to 8192 tokens */
export const MAX_TOKENS = 8192;

// =============================================================================
// Worker Management
// =============================================================================

let worker: Worker | null = null;
let readyPromise: Promise<void> | null = null;
let requestId = 0;

/** Pending requests waiting for responses */
const pendingRequests = new Map<
	number,
	{
		resolve: (embedding: Float32Array) => void;
		reject: (error: Error) => void;
	}
>();

/**
 * Initialize the embedding worker.
 */
function initWorker(): Promise<void> {
	if (readyPromise) {
		return readyPromise;
	}

	readyPromise = new Promise((resolve, reject) => {
		const workerUrl = new URL("./worker.ts", import.meta.url);
		worker = new Worker(workerUrl);

		worker.onmessage = (event) => {
			const message = event.data;

			if (message.type === "ready") {
				resolve();
				return;
			}

			if (message.type === "result" || message.type === "error") {
				const pending = pendingRequests.get(message.id);
				if (pending) {
					pendingRequests.delete(message.id);

					if (message.type === "result") {
						pending.resolve(message.embedding);
					} else {
						pending.reject(new Error(message.error));
					}
				}
			}
		};

		worker.onerror = (error) => {
			console.error("[Embedding] Worker error:", error);
			reject(error);
		};
	});

	return readyPromise;
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Generate an embedding vector for a single text input.
 * Runs in a worker thread to avoid blocking the main event loop.
 *
 * @param text - The text to embed
 * @returns A Float32Array of length 768
 */
export async function embed(text: string): Promise<Float32Array> {
	await initWorker();

	if (!worker) {
		throw new Error("Worker not initialized");
	}

	const id = ++requestId;

	const currentWorker = worker;

	return new Promise((resolve, reject) => {
		pendingRequests.set(id, { resolve, reject });

		currentWorker.postMessage({
			id,
			type: "embed",
			text,
		});
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

	// Process sequentially through the worker
	const results: Float32Array[] = [];
	for (const text of texts) {
		const embedding = await embed(text);
		results.push(embedding);
	}

	return results;
}

/**
 * Preload the embedding model.
 * Call this at startup to avoid latency on first embed call.
 */
export async function preloadModel(): Promise<void> {
	await initWorker();
}

/**
 * Terminate the embedding worker.
 */
export function terminateWorker(): void {
	if (worker) {
		worker.terminate();
		worker = null;
		readyPromise = null;
		pendingRequests.clear();
	}
}
