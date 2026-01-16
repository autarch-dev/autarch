/**
 * Embed CLI provider - Downloads and caches the embed binary.
 *
 * Downloads to ~/.autarch/bin/embed on supported platforms.
 * Returns null on unsupported platforms (embeddings disabled).
 */

import { chmod, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { createLogger } from "@/backend/logger";

const logger = createLogger("embed");

// =============================================================================
// Constants
// =============================================================================

const CDN_BASE_URL = "https://cdn.autarch.dev/embed/latest";

const BIN_DIR = join(homedir(), ".autarch", "bin");

/**
 * Map of Node.js platform keys to CDN filenames.
 * Only these platforms are supported - all others return null.
 */
const PLATFORM_MAP: Record<string, string> = {
	"x64-linux": "embed-linux-x64",
	"arm64-darwin": "embed-darwin-arm64",
	"x64-win32": "embed-windows-x64.exe",
} as const;

// =============================================================================
// Errors
// =============================================================================

export class DownloadFailedError extends Error {
	constructor(url: string, status: number) {
		super(`Failed to download embed CLI from ${url} (HTTP ${status})`);
		this.name = "DownloadFailedError";
	}
}

// =============================================================================
// Internal Helpers
// =============================================================================

function getPlatformKey(): string {
	return `${process.arch}-${process.platform}`;
}

function getRemoteFilename(): string | null {
	return PLATFORM_MAP[getPlatformKey()] ?? null;
}

function getLocalBinaryPath(): string {
	const suffix = process.platform === "win32" ? ".exe" : "";
	return join(BIN_DIR, `embed${suffix}`);
}

async function ensureBinDir(): Promise<void> {
	await mkdir(BIN_DIR, { recursive: true });
}

async function downloadEmbed(): Promise<string> {
	const remoteFilename = getRemoteFilename();
	if (!remoteFilename) {
		throw new Error(`Unsupported platform: ${getPlatformKey()}`);
	}

	const destPath = getLocalBinaryPath();
	const url = `${CDN_BASE_URL}/${remoteFilename}`;

	logger.info(`Downloading from ${url}`);

	await ensureBinDir();

	let response: Response;
	try {
		response = await fetch(url);
	} catch (err) {
		logger.error(`Network error downloading embed CLI: ${err}`);
		throw err;
	}

	if (!response.ok) {
		throw new DownloadFailedError(url, response.status);
	}

	const contentLength = response.headers.get("content-length");
	if (contentLength) {
		const sizeMB = (Number.parseInt(contentLength, 10) / 1024 / 1024).toFixed(
			1,
		);
		logger.info(`Download size: ${sizeMB} MB`);
	}

	logger.info("Downloading...");
	const buffer = await response.arrayBuffer();

	logger.info(`Writing to ${destPath}...`);
	await Bun.write(destPath, buffer);

	// Make executable on Unix
	if (process.platform !== "win32") {
		await chmod(destPath, 0o755);
	}

	logger.success(`Embed CLI installed to ${destPath}`);
	return destPath;
}

// =============================================================================
// Lazy Initialization
// =============================================================================

let cachedPath: string | null = null;
let initPromise: Promise<string | null> | null = null;

async function initEmbed(): Promise<string | null> {
	// Check if platform is supported
	if (!getRemoteFilename()) {
		logger.warn(`Unsupported platform: ${getPlatformKey()}`);
		logger.warn("Embeddings will be disabled");
		return null;
	}

	// Check if we've already downloaded it
	const localPath = getLocalBinaryPath();
	const localFile = Bun.file(localPath);
	if (await localFile.exists()) {
		logger.debug(`Using cached embed CLI: ${localPath}`);
		return localPath;
	}

	// Download it
	logger.info("Embed CLI not found, downloading...");
	return downloadEmbed();
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Check if the current platform supports embeddings.
 */
export function isEmbeddingSupported(): boolean {
	return getRemoteFilename() !== null;
}

/**
 * Get the path to the embed CLI binary.
 *
 * Returns null on unsupported platforms. On supported platforms,
 * downloads the binary if not already cached.
 */
export async function getEmbedPath(): Promise<string | null> {
	if (cachedPath !== null) {
		return cachedPath;
	}

	// Use a shared promise to prevent concurrent downloads
	if (!initPromise) {
		initPromise = initEmbed();
	}

	cachedPath = await initPromise;
	return cachedPath;
}
