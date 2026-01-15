/**
 * Ripgrep provider - Lazily downloads and caches the ripgrep binary.
 *
 * Uses the system ripgrep if available, otherwise downloads to ~/.autarch/bin/
 */

import { chmod, mkdir, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { BlobReader, BlobWriter, ZipReader } from "@zip.js/zip.js";
import { createLogger } from "@/backend/logger";

const logger = createLogger("ripgrep");

// =============================================================================
// Constants
// =============================================================================

const RIPGREP_VERSION = "14.1.1";

const BIN_DIR = join(homedir(), ".autarch", "bin");

const PLATFORM_CONFIG = {
	"x64-darwin": { platform: "x86_64-apple-darwin", extension: "tar.gz" },
	"arm64-darwin": { platform: "aarch64-apple-darwin", extension: "tar.gz" },
	"x64-linux": { platform: "x86_64-unknown-linux-musl", extension: "tar.gz" },
	"arm64-linux": { platform: "aarch64-unknown-linux-gnu", extension: "tar.gz" },
	"x64-win32": { platform: "x86_64-pc-windows-msvc", extension: "zip" },
} as const;

type PlatformKey = keyof typeof PLATFORM_CONFIG;

// =============================================================================
// Errors
// =============================================================================

export class UnsupportedPlatformError extends Error {
	constructor(platform: string) {
		super(`Unsupported platform: ${platform}`);
		this.name = "UnsupportedPlatformError";
	}
}

export class DownloadFailedError extends Error {
	constructor(url: string, status: number) {
		super(`Failed to download ripgrep from ${url} (HTTP ${status})`);
		this.name = "DownloadFailedError";
	}
}

export class ExtractionFailedError extends Error {
	constructor(message: string) {
		super(`Failed to extract ripgrep: ${message}`);
		this.name = "ExtractionFailedError";
	}
}

// =============================================================================
// Internal Helpers
// =============================================================================

function getPlatformKey(): PlatformKey {
	const key = `${process.arch}-${process.platform}`;
	if (!(key in PLATFORM_CONFIG)) {
		throw new UnsupportedPlatformError(key);
	}
	return key as PlatformKey;
}

function getLocalBinaryPath(): string {
	const suffix = process.platform === "win32" ? ".exe" : "";
	return join(BIN_DIR, `rg${suffix}`);
}

async function ensureBinDir(): Promise<void> {
	await mkdir(BIN_DIR, { recursive: true });
}

async function extractTarGz(
	archivePath: string,
	platformKey: PlatformKey,
): Promise<void> {
	const args = ["tar", "-xzf", archivePath, "--strip-components=1"];

	// Platform-specific args to extract only the rg binary
	if (platformKey.endsWith("-darwin")) {
		args.push("--include=*/rg");
	} else if (platformKey.endsWith("-linux")) {
		args.push("--wildcards", "*/rg");
	}

	logger.debug(`Running: ${args.join(" ")}`);
	const proc = Bun.spawn(args, {
		cwd: BIN_DIR,
		stdout: "pipe",
		stderr: "pipe",
	});

	const exitCode = await proc.exited;
	logger.debug(`tar exited with code ${exitCode}`);

	if (exitCode !== 0) {
		const stderr = await new Response(proc.stderr).text();
		throw new ExtractionFailedError(
			stderr || `tar exited with code ${exitCode}`,
		);
	}
}

async function extractZip(
	archivePath: string,
	destPath: string,
): Promise<void> {
	const archiveBuffer = await Bun.file(archivePath).arrayBuffer();
	const zipReader = new ZipReader(new BlobReader(new Blob([archiveBuffer])));

	try {
		const entries = await zipReader.getEntries();
		const rgEntry = entries.find((entry) => entry.filename.endsWith("rg.exe"));

		if (!rgEntry || rgEntry.directory) {
			throw new ExtractionFailedError("rg.exe not found in archive");
		}

		// getData exists on file entries (non-directory)
		const blob = await rgEntry.getData(new BlobWriter());
		await Bun.write(destPath, await blob.arrayBuffer());
	} finally {
		await zipReader.close();
	}
}

async function downloadRipgrep(): Promise<string> {
	const platformKey = getPlatformKey();
	const config = PLATFORM_CONFIG[platformKey];
	const destPath = getLocalBinaryPath();

	logger.debug(`Platform: ${platformKey}`);
	logger.debug(`Destination: ${destPath}`);

	await ensureBinDir();

	// Build download URL
	const filename = `ripgrep-${RIPGREP_VERSION}-${config.platform}.${config.extension}`;
	const url = `https://github.com/BurntSushi/ripgrep/releases/download/${RIPGREP_VERSION}/${filename}`;
	const archivePath = join(BIN_DIR, filename);

	// Download archive
	logger.debug(`Downloading from ${url}`);
	const response = await fetch(url);
	if (!response.ok) {
		throw new DownloadFailedError(url, response.status);
	}

	logger.debug("Writing archive to disk...");
	await Bun.write(archivePath, response);

	// Extract based on archive type
	logger.debug(`Extracting ${config.extension} archive...`);
	try {
		if (config.extension === "tar.gz") {
			await extractTarGz(archivePath, platformKey);
		} else {
			await extractZip(archivePath, destPath);
		}
	} finally {
		// Clean up archive regardless of success/failure
		logger.debug("Cleaning up archive...");
		await rm(archivePath, { force: true });
	}

	// Make executable on Unix
	if (process.platform !== "win32") {
		await chmod(destPath, 0o755);
	}

	logger.success(`Ripgrep installed to ${destPath}`);
	return destPath;
}

// =============================================================================
// Lazy Initialization
// =============================================================================

let cachedPath: string | null = null;
let initPromise: Promise<string> | null = null;

async function initRipgrep(): Promise<string> {
	logger.debug("Initializing ripgrep...");

	// Check for system ripgrep first
	const systemPath = Bun.which("rg");
	if (systemPath) {
		logger.debug(`Using system ripgrep: ${systemPath}`);
		return systemPath;
	}

	// Check if we've already downloaded it
	const localPath = getLocalBinaryPath();
	const localFile = Bun.file(localPath);
	if (await localFile.exists()) {
		logger.debug(`Using cached ripgrep: ${localPath}`);
		return localPath;
	}

	// Download it
	logger.info("Ripgrep not found, downloading...");
	return downloadRipgrep();
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Get the path to the ripgrep binary.
 *
 * Returns the system ripgrep if available, otherwise downloads to ~/.autarch/bin/
 * and returns that path. The result is cached after first call.
 */
export async function getRipgrepPath(): Promise<string> {
	if (cachedPath) {
		return cachedPath;
	}

	// Use a shared promise to prevent concurrent downloads
	if (!initPromise) {
		initPromise = initRipgrep();
	}

	cachedPath = await initPromise;
	return cachedPath;
}
