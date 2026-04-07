/**
 * Shared output truncation utilities
 */

/** Size of head portion to preserve when truncating */
const HEAD_SIZE = 1024; // 1KB

/** Size of tail portion to preserve when truncating */
const TAIL_SIZE = 3072; // 3KB

/**
 * Format byte count for display (KB with one decimal for >= 1024, bytes otherwise)
 */
export function formatBytes(bytes: number): string {
	if (bytes >= 1024) {
		return `${(bytes / 1024).toFixed(1)}KB`;
	}
	return `${bytes} bytes`;
}

/**
 * Truncate output using head+tail strategy if it exceeds max size.
 * Uses HEAD_SIZE:TAIL_SIZE ratio (1:3) scaled to maxSize for truncation bounds.
 */
export function truncateOutput(output: string, maxSize: number): string {
	if (output.length <= maxSize) {
		return output;
	}
	// Scale head/tail sizes proportionally to maxSize, maintaining 1:3 ratio
	const totalParts = HEAD_SIZE + TAIL_SIZE; // 4KB
	const headSize = Math.floor((HEAD_SIZE / totalParts) * maxSize);
	const tailSize = maxSize - headSize;

	const omittedBytes = output.length - headSize - tailSize;
	const omissionMsg = `\n... [${formatBytes(omittedBytes)} omitted] ...\n`;
	return output.slice(0, headSize) + omissionMsg + output.slice(-tailSize);
}
