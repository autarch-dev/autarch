/**
 * Timeout logging utilities for shell and verification commands.
 *
 * When a spawned process times out, we kill it and then try to read
 * whatever partial stdout/stderr was buffered before the kill.
 * The output is dumped to .autarch/logs/ for post-mortem debugging.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { log } from "@/backend/logger";

const PARTIAL_OUTPUT_WAIT_MS = 5_000;

/**
 * After a process is killed, await its stdout/stderr promises with a
 * safety timeout so we don't hang if the streams never close.
 */
export async function collectPartialOutput(
	stdoutPromise: Promise<string>,
	stderrPromise: Promise<string>,
	waitMs = PARTIAL_OUTPUT_WAIT_MS,
): Promise<{ stdout: string; stderr: string }> {
	const withFallback = <T>(promise: Promise<T>, fallback: T) =>
		Promise.race([
			promise,
			new Promise<T>((resolve) => setTimeout(() => resolve(fallback), waitMs)),
		]);

	const [stdout, stderr] = await Promise.all([
		withFallback(stdoutPromise, ""),
		withFallback(stderrPromise, ""),
	]);

	return { stdout, stderr };
}

/**
 * Write a structured timeout log to .autarch/logs/.
 */
export async function dumpTimeoutLog(opts: {
	projectRoot: string;
	label: string;
	command: string;
	timeoutSeconds: number;
	stdout: string;
	stderr: string;
}): Promise<void> {
	try {
		const targetFolder = path.join(opts.projectRoot, ".autarch", "logs");
		await fs.mkdir(targetFolder, { recursive: true });

		const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
		const targetFile = path.join(
			targetFolder,
			`${opts.label}_timeout_${timestamp}.log`,
		);

		const content = [
			`Command: ${opts.command}`,
			`Timeout: ${opts.timeoutSeconds}s`,
			`Timestamp: ${new Date().toISOString()}`,
			"",
			"--- stdout ---",
			opts.stdout || "(empty)",
			"",
			"--- stderr ---",
			opts.stderr || "(empty)",
		].join("\n");

		await fs.writeFile(targetFile, content);
		log.tools.info(`Timeout log written to ${targetFile}`);
	} catch (err) {
		log.tools.error(`Failed to write timeout log: ${err}`);
	}
}
