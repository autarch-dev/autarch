import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
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

/** Model produces 768-dimensional vectors */
export const EMBEDDING_DIMENSIONS = 768;

/** Model supports up to 8192 tokens */
export const MAX_TOKENS = 8192;

// =============================================================================
// Pipeline Singleton
// =============================================================================

let embeddingPipeline: FeatureExtractionPipeline | null = null;
let initPromise: Promise<FeatureExtractionPipeline> | null = null;

/**
 * Ensure the model cache directory exists
 */
function ensureCacheDir(): void {
	if (!existsSync(CACHE_DIR)) {
		mkdirSync(CACHE_DIR, { recursive: true });
	}
}

/**
 * Initialize the embedding pipeline (lazy, singleton).
 * Downloads the model on first use if not cached.
 */
async function getEmbeddingPipeline(): Promise<FeatureExtractionPipeline> {
	if (embeddingPipeline) {
		return embeddingPipeline;
	}

	if (initPromise) {
		return initPromise;
	}

	initPromise = (async () => {
		ensureCacheDir();

		// Configure transformers.js to use our cache directory
		env.cacheDir = CACHE_DIR;
		env.allowLocalModels = true;

		console.log(`Loading embedding model: ${MODEL_ID}`);
		const pipe = await pipeline("feature-extraction", MODEL_ID, {
			quantized: false, // Use full precision for better quality
		});
		console.log("Embedding model loaded");

		embeddingPipeline = pipe;
		return pipe;
	})();

	return initPromise;
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Generate an embedding vector for a single text input.
 *
 * @param text - The text to embed
 * @returns A Float32Array of length 768
 */
export async function embed(text: string): Promise<Float32Array> {
	const pipe = await getEmbeddingPipeline();
	const output = await pipe(text, { pooling: "mean", normalize: true });

	if (!(output.data instanceof Float32Array)) {
		throw new Error("Unexpected embedding data type");
	}
	return output.data;
}

/**
 * Generate embedding vectors for multiple texts in a batch.
 * More efficient than calling embed() multiple times.
 *
 * @param texts - Array of texts to embed
 * @returns Array of Float32Arrays, each of length 768
 */
export async function embedBatch(texts: string[]): Promise<Float32Array[]> {
	if (texts.length === 0) {
		return [];
	}

	const pipe = await getEmbeddingPipeline();
	const results: Float32Array[] = [];

	// Process sequentially to manage memory
	for (const text of texts) {
		const output = await pipe(text, { pooling: "mean", normalize: true });

		if (!(output.data instanceof Float32Array)) {
			throw new Error("Unexpected embedding data type");
		}
		results.push(output.data);
	}

	return results;
}

/**
 * Preload the embedding model.
 * Call this at startup to avoid latency on first embed call.
 */
export async function preloadModel(): Promise<void> {
	await getEmbeddingPipeline();
}
