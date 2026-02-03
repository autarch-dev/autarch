/**
 * Shared helper functions for extracting context from edit operations
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Represents a position where a replacement occurred
 */
export interface ReplacementPosition {
	/** Character position in the content where replacement starts */
	charPosition: number;
	/** Number of lines in the new string that was inserted */
	newStringLineCount: number;
}

/**
 * Represents a line range for context extraction
 */
export interface LineRange {
	startLine: number;
	endLine: number;
}

/**
 * Result from extracting context lines
 */
export interface ExtractedContext {
	lines: string[];
	actualStart: number;
	actualEnd: number;
}

// =============================================================================
// Position Finding Functions
// =============================================================================

/**
 * Find all occurrence positions of a substring in content.
 * Returns array of starting character positions (0-indexed).
 */
export function findAllOccurrencePositions(
	content: string,
	search: string,
): number[] {
	const positions: number[] = [];
	let pos = content.indexOf(search, 0);
	while (pos !== -1) {
		positions.push(pos);
		pos = content.indexOf(search, pos + search.length);
	}
	return positions;
}

/**
 * Get 1-based line number for a character position in content.
 */
export function getLineNumber(content: string, position: number): number {
	return content.substring(0, position).split("\n").length;
}

// =============================================================================
// Context Extraction Functions
// =============================================================================

/**
 * Extract context lines with file boundary handling.
 *
 * @param lines Array of file lines (0-indexed internally)
 * @param startLine 1-based start line of the target region
 * @param endLine 1-based end line of the target region
 * @param contextSize Number of context lines before and after
 * @returns Extracted lines and actual 1-based start/end after boundary clamping
 */
export function extractContextLines(
	lines: string[],
	startLine: number,
	endLine: number,
	contextSize: number,
): ExtractedContext {
	const actualStart = Math.max(1, startLine - contextSize);
	const actualEnd = Math.min(lines.length, endLine + contextSize);
	// Convert to 0-indexed for array slice
	const extractedLines = lines.slice(actualStart - 1, actualEnd);
	return { lines: extractedLines, actualStart, actualEnd };
}

/**
 * Format context output with markdown header.
 *
 * @param filePath Path to the file
 * @param startLine 1-based start line
 * @param endLine 1-based end line
 * @param contextLines Array of lines to include
 * @returns Formatted markdown string
 */
export function formatContextOutput(
	filePath: string,
	startLine: number,
	endLine: number,
	contextLines: string[],
): string {
	return `### ${filePath}:${startLine}-${endLine}\n${contextLines.join("\n")}`;
}

// =============================================================================
// Edit Context Tracking Functions
// =============================================================================

/**
 * Calculate replacement positions in the final content for a single edit.
 *
 * This function finds where oldString occurs in the original content,
 * then calculates where the replacement will be in the new content.
 *
 * @param originalContent Content before replacement
 * @param oldString String being replaced
 * @param newString Replacement string
 * @param replaceAll If true, find all occurrences; otherwise, just the first
 * @returns Array of positions in the new content with line counts
 */
export function calculateReplacementPositions(
	originalContent: string,
	oldString: string,
	newString: string,
	replaceAll: boolean,
): ReplacementPosition[] {
	const positions: ReplacementPosition[] = [];
	const newStringLineCount = newString.split("\n").length;
	const lengthDiff = newString.length - oldString.length;

	// Find positions in original content
	const originalPositions = findAllOccurrencePositions(
		originalContent,
		oldString,
	);

	if (originalPositions.length === 0) {
		return [];
	}

	// For non-replaceAll, only use the first occurrence
	// We've already checked that originalPositions.length > 0 above
	const firstPos = originalPositions[0];
	if (firstPos === undefined) {
		return [];
	}
	const positionsToUse = replaceAll ? originalPositions : [firstPos];

	// Calculate positions in the new content
	// Each replacement shifts subsequent positions by lengthDiff
	let cumulativeOffset = 0;
	for (const origPos of positionsToUse) {
		const newPos = origPos + cumulativeOffset;
		positions.push({
			charPosition: newPos,
			newStringLineCount,
		});
		cumulativeOffset += lengthDiff;
	}

	return positions;
}

/**
 * Convert replacement positions to line ranges in the final content.
 *
 * @param newContent The content after all replacements
 * @param positions Array of replacement positions
 * @returns Array of line ranges (1-based)
 */
export function positionsToLineRanges(
	newContent: string,
	positions: ReplacementPosition[],
): LineRange[] {
	return positions.map((pos) => {
		const startLine = getLineNumber(newContent, pos.charPosition);
		const endLine = startLine + pos.newStringLineCount - 1;
		return { startLine, endLine };
	});
}

/**
 * Merge overlapping or adjacent line ranges.
 * Ranges within `gapThreshold` lines are merged together.
 *
 * @param ranges Array of line ranges to merge
 * @param gapThreshold Maximum gap between ranges to still merge (default: 10)
 * @returns Merged array of line ranges
 */
export function mergeLineRanges(
	ranges: LineRange[],
	gapThreshold = 10,
): LineRange[] {
	if (ranges.length === 0) {
		return [];
	}

	// Sort ranges by startLine ascending
	const sortedRanges = [...ranges].sort((a, b) => a.startLine - b.startLine);

	const mergedRanges: LineRange[] = [];
	let currentRange: LineRange | null = null;

	for (const range of sortedRanges) {
		if (currentRange === null) {
			currentRange = { startLine: range.startLine, endLine: range.endLine };
		} else if (currentRange.endLine + gapThreshold >= range.startLine) {
			// Merge: extend currentRange.endLine to include range
			currentRange.endLine = Math.max(currentRange.endLine, range.endLine);
		} else {
			// No merge: push currentRange and start new one
			mergedRanges.push(currentRange);
			currentRange = { startLine: range.startLine, endLine: range.endLine };
		}
	}

	if (currentRange !== null) {
		mergedRanges.push(currentRange);
	}

	return mergedRanges;
}

/**
 * Build formatted context output for edit operations.
 *
 * @param filePath Normalized file path
 * @param newContent Content after edits
 * @param lineRanges Line ranges to extract context for
 * @param contextSize Number of context lines before/after (default: 5)
 * @returns Formatted context string with all blocks
 */
export function buildContextOutput(
	filePath: string,
	newContent: string,
	lineRanges: LineRange[],
	contextSize = 5,
): string {
	if (lineRanges.length === 0) {
		return "";
	}

	const lines = newContent.split("\n");
	const contextBlocks: string[] = [];

	for (const range of lineRanges) {
		const extracted = extractContextLines(
			lines,
			range.startLine,
			range.endLine,
			contextSize,
		);

		const formatted = formatContextOutput(
			filePath,
			extracted.actualStart,
			extracted.actualEnd,
			extracted.lines,
		);

		contextBlocks.push(formatted);
	}

	return contextBlocks.join("\n\n");
}

// =============================================================================
// Multi-Edit Context Tracking
// =============================================================================

/**
 * Track replacement positions for a multi-edit operation.
 *
 * This tracks positions as edits are applied sequentially, maintaining
 * a running offset to correctly locate replacements in the final content.
 *
 * @param originalContent Starting content
 * @param edits Array of edit operations
 * @returns Array of line ranges in the final content
 */
export function trackMultiEditPositions(
	originalContent: string,
	edits: Array<{ oldString: string; newString: string; replaceAll?: boolean }>,
): LineRange[] {
	const allPositions: ReplacementPosition[] = [];
	let currentContent = originalContent;

	for (const edit of edits) {
		// Find positions of oldString in current content state
		const positionsInCurrent = findAllOccurrencePositions(
			currentContent,
			edit.oldString,
		);

		if (positionsInCurrent.length === 0) {
			continue;
		}

		// For non-replaceAll, only use the first occurrence
		const firstPos = positionsInCurrent[0];
		if (firstPos === undefined) {
			continue;
		}
		const positionsToUse = edit.replaceAll ? positionsInCurrent : [firstPos];

		const lengthDiff = edit.newString.length - edit.oldString.length;
		const newStringLineCount = edit.newString.split("\n").length;

		// Track each replacement position
		// Positions are found in currentContent (after previous edits), which is already
		// in the correct coordinate system. We only need thisEditOffset to account for
		// earlier replacements within THIS edit (for replaceAll).
		let thisEditOffset = 0;
		for (const posInCurrent of positionsToUse) {
			const finalPos = posInCurrent + thisEditOffset;
			allPositions.push({
				charPosition: finalPos,
				newStringLineCount,
			});
			thisEditOffset += lengthDiff;
		}

		// Apply the edit to get the next content state
		if (edit.replaceAll) {
			currentContent = currentContent
				.split(edit.oldString)
				.join(edit.newString);
		} else {
			currentContent = currentContent.replace(edit.oldString, edit.newString);
		}
	}

	// Convert all positions to line ranges in the final content
	return positionsToLineRanges(currentContent, allPositions);
}
