import { type FSWatcher, watch } from "node:fs";
import { extname } from "node:path";
import { log } from "@/backend/logger";
import { isSupportedExtension, pathContainsExcludedDir } from "./config";
import { indexProject, removeFile, updateFile } from "./indexer";
import { initEmbed, isEmbeddingAvailable } from "./provider";

/** Debounce delay for file changes (ms) */
const DEBOUNCE_MS = 300;

// =============================================================================
// State
// =============================================================================

let watcher: FSWatcher | null = null;
let projectRoot: string | null = null;

/** Pending file updates (debounced) */
const pendingUpdates = new Map<string, NodeJS.Timeout>();

// =============================================================================
// Watcher
// =============================================================================

/**
 * Start watching a project directory for file changes.
 * Automatically indexes the project first, then watches for changes.
 *
 * @param root - The project root directory to watch
 */
export async function startWatching(root: string): Promise<void> {
	if (watcher) {
		log.embedding.debug("Watcher already running");
		return;
	}

	// Check if embeddings are available on this platform
	if (!isEmbeddingAvailable()) {
		log.embedding.warn(
			`Embeddings disabled: unsupported platform (${process.arch}-${process.platform})`,
		);
		return;
	}

	// Initialize the embed CLI (downloads if needed, starts process)
	let available: boolean;
	try {
		available = await initEmbed();
	} catch (err) {
		log.embedding.error("Failed to initialize embed CLI:", err);
		return;
	}
	if (!available) {
		log.embedding.warn("Embeddings disabled: embed CLI not available");
		return;
	}

	projectRoot = root;
	log.embedding.info(`Starting file watcher for: ${root}`);

	// Initial index
	try {
		await indexProject(root);
	} catch (error) {
		log.embedding.error("Initial indexing failed:", error);
	}

	// Start watching with recursive option (Bun supports this natively)
	watcher = watch(root, { recursive: true }, (eventType, filename) => {
		if (!filename || !projectRoot) return;

		// Skip excluded directories
		if (pathContainsExcludedDir(filename)) {
			return;
		}

		// Check extension
		const ext = extname(filename);
		if (!isSupportedExtension(ext)) {
			return;
		}

		// Debounce updates for the same file
		const existingTimeout = pendingUpdates.get(filename);
		if (existingTimeout) {
			clearTimeout(existingTimeout);
		}

		const timeout = setTimeout(() => {
			pendingUpdates.delete(filename);
			handleFileChange(eventType, filename);
		}, DEBOUNCE_MS);

		pendingUpdates.set(filename, timeout);
	});

	watcher.on("error", (error) => {
		log.embedding.error("File watcher error:", error);
	});

	log.embedding.success("File watcher started");
}

/**
 * Stop watching for file changes.
 */
export function stopWatching(): void {
	if (watcher) {
		watcher.close();
		watcher = null;
		projectRoot = null;

		// Clear pending updates
		for (const timeout of pendingUpdates.values()) {
			clearTimeout(timeout);
		}
		pendingUpdates.clear();

		log.embedding.info("File watcher stopped");
	}
}

/**
 * Handle a file change event.
 */
async function handleFileChange(
	eventType: string,
	filename: string,
): Promise<void> {
	if (!projectRoot) return;

	const relativePath = filename;

	try {
		if (eventType === "rename") {
			// 'rename' can mean created, deleted, or renamed
			// Try to update - if file doesn't exist, removeFile handles it
			await updateFile(projectRoot, relativePath);
		} else {
			// 'change' means content modified
			await updateFile(projectRoot, relativePath);
		}
		log.embedding.debug(`Indexed: ${relativePath}`);
	} catch (error) {
		// File might have been deleted
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			await removeFile(projectRoot, relativePath);
			log.embedding.debug(`Removed from index: ${relativePath}`);
		} else {
			log.embedding.error(`Failed to index ${relativePath}:`, error);
		}
	}
}

/**
 * Check if the watcher is currently running.
 */
export function isWatching(): boolean {
	return watcher !== null;
}
