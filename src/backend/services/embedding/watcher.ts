import { type FSWatcher, watch } from "node:fs";
import { extname } from "node:path";
import { isSupportedExtension, pathContainsExcludedDir } from "./config";
import { indexProject, removeFile, updateFile } from "./indexer";

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
		console.log("Watcher already running");
		return;
	}

	projectRoot = root;
	console.log(`Starting file watcher for: ${root}`);

	// Initial index
	try {
		await indexProject(root);
	} catch (error) {
		console.error("Initial indexing failed:", error);
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
		console.error("File watcher error:", error);
	});

	console.log("File watcher started");
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

		console.log("File watcher stopped");
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
		console.log(`Indexed: ${relativePath}`);
	} catch (error) {
		// File might have been deleted
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			await removeFile(projectRoot, relativePath);
			console.log(`Removed from index: ${relativePath}`);
		} else {
			console.error(`Failed to index ${relativePath}:`, error);
		}
	}
}

/**
 * Check if the watcher is currently running.
 */
export function isWatching(): boolean {
	return watcher !== null;
}
