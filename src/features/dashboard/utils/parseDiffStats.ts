/**
 * Diff stats parser utility for extracting aggregate change counts from
 * unified diff content.
 *
 * Intentionally simpler than DiffViewer's parseUnifiedDiff — we only need
 * file count, total additions, and total deletions for summary display.
 */

/** Aggregate diff statistics */
export interface DiffStats {
	fileCount: number;
	additions: number;
	deletions: number;
}

/**
 * Parse unified diff content and return aggregate statistics.
 *
 * @param diffContent - Raw unified diff string, or null/undefined
 * @returns Aggregate counts of files changed, lines added, and lines deleted
 */
export function parseDiffStats(
	diffContent: string | null | undefined,
): DiffStats {
	if (!diffContent) {
		return { fileCount: 0, additions: 0, deletions: 0 };
	}

	const lines = diffContent.split("\n");

	let fileCount = 0;
	let additions = 0;
	let deletions = 0;

	for (const line of lines) {
		if (/^diff --git /.test(line)) {
			fileCount++;
		} else if (line.startsWith("+") && !line.startsWith("+++")) {
			additions++;
		} else if (line.startsWith("-") && !line.startsWith("---")) {
			deletions++;
		}
	}

	return { fileCount, additions, deletions };
}
