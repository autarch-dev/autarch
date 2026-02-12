/**
 * Analytics formatting utilities
 *
 * Shared formatters for numeric display across analytics dashboard components.
 */

/** Format a number with comma separators */
export function formatNumber(n: number): string {
	return n.toLocaleString();
}

/** Format seconds into a human-readable duration string */
export function formatDuration(seconds: number): string {
	if (seconds < 60) {
		return `${seconds.toFixed(1)}s`;
	}
	if (seconds < 3600) {
		const mins = Math.floor(seconds / 60);
		const secs = Math.round(seconds % 60);
		return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
	}
	const hours = Math.floor(seconds / 3600);
	const mins = Math.round((seconds % 3600) / 60);
	return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}
