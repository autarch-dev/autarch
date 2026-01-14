/**
 * Embedding worker - runs in a separate thread to avoid blocking the main event loop.
 */

import { existsSync, mkdirSync } from "node:fs";
import { cpus, homedir } from "node:os";
import { join } from "node:path";
import {
	env,
	type FeatureExtractionPipeline,
	pipeline,
} from "@xenova/transformers";

// =============================================================================
// Configuration
// =============================================================================

const MODEL_ID = "jinaai/jina-embeddings-v2-base-code";
const CACHE_DIR = join(homedir(), ".autarch", "models");

// =============================================================================
// Types
// =============================================================================

interface EmbedRequest {
	id: number;
	type: "embed";
	text: string;
}

interface EmbedResponse {
	id: number;
	type: "result";
	embedding: Float32Array;
}

interface ErrorResponse {
	id: number;
	type: "error";
	error: string;
}

interface ReadyMessage {
	type: "ready";
}

type WorkerMessage = EmbedRequest;

// =============================================================================
// Pipeline
// =============================================================================

let embeddingPipeline: FeatureExtractionPipeline | null = null;

async function initPipeline(): Promise<void> {
	if (!existsSync(CACHE_DIR)) {
		mkdirSync(CACHE_DIR, { recursive: true });
	}

	env.cacheDir = CACHE_DIR;
	env.allowLocalModels = true;

	// Use 50% of available threads
	const numThreads = Math.max(1, Math.floor(cpus().length / 2));
	env.backends.onnx.wasm.numThreads = numThreads;

	console.log(
		`[Worker] Loading embedding model: ${MODEL_ID} (${numThreads} threads)`,
	);
	embeddingPipeline = await pipeline("feature-extraction", MODEL_ID, {
		quantized: false,
	});
	console.log("[Worker] Embedding model loaded");
}

async function embed(text: string): Promise<Float32Array> {
	if (!embeddingPipeline) {
		throw new Error("Pipeline not initialized");
	}

	const output = await embeddingPipeline(text, {
		pooling: "mean",
		normalize: true,
	});

	if (!(output.data instanceof Float32Array)) {
		throw new Error("Unexpected embedding data type");
	}

	return output.data;
}

// =============================================================================
// Message Handler
// =============================================================================

declare const self: Worker;

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
	const message = event.data;

	if (message.type === "embed") {
		try {
			const embedding = await embed(message.text);
			const response: EmbedResponse = {
				id: message.id,
				type: "result",
				embedding,
			};
			self.postMessage(response);
		} catch (error) {
			const response: ErrorResponse = {
				id: message.id,
				type: "error",
				error: error instanceof Error ? error.message : String(error),
			};
			self.postMessage(response);
		}
	}
};

// Initialize pipeline on worker start
initPipeline().then(() => {
	const ready: ReadyMessage = { type: "ready" };
	self.postMessage(ready);
});
