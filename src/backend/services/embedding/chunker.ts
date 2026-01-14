import { createHash } from "node:crypto";

// =============================================================================
// Configuration
// =============================================================================

/** Target number of tokens per chunk */
const TARGET_TOKENS = 512;

/** Number of overlap tokens between chunks */
const OVERLAP_TOKENS = 64;

/** Skip lines longer than this (likely generated/minified) */
const MAX_LINE_LENGTH = 1000;

/** Approximate characters per token (for estimation) */
const CHARS_PER_TOKEN = 4;

// =============================================================================
// Types
// =============================================================================

export interface TextChunk {
	/** SHA256 hash of the chunk text (for deduplication) */
	contentHash: string;
	/** The actual chunk text */
	text: string;
	/** Estimated token count */
	tokenCount: number;
	/** 1-based start line in the original file */
	startLine: number;
	/** 1-based end line in the original file (inclusive) */
	endLine: number;
}

// =============================================================================
// Token Estimation
// =============================================================================

/**
 * Estimate token count for a piece of text.
 * Uses a simple character-based heuristic.
 */
export function estimateTokens(text: string): number {
	return Math.ceil(text.length / CHARS_PER_TOKEN);
}

// =============================================================================
// Hashing
// =============================================================================

/**
 * Compute SHA256 hash of text for content-based deduplication.
 */
function hashContent(text: string): string {
	return createHash("sha256").update(text).digest("hex");
}

// =============================================================================
// Chunking
// =============================================================================

/**
 * Split file content into overlapping chunks suitable for embedding.
 *
 * Algorithm:
 * 1. Split file content by newlines
 * 2. Skip lines exceeding MAX_LINE_LENGTH (generated/minified)
 * 3. Accumulate lines until target token count is reached
 * 4. Create chunk with line number metadata
 * 5. Back up by overlap tokens for next chunk start
 * 6. Repeat until end of file
 *
 * @param content - The full file content
 * @returns Array of text chunks with metadata
 */
export function chunkText(content: string): TextChunk[] {
	const lines = content.split("\n");
	const chunks: TextChunk[] = [];

	let currentChunkLines: string[] = [];
	let currentTokenCount = 0;
	let chunkStartLine = 1;
	let lineIndex = 0;

	while (lineIndex < lines.length) {
		const line = lines[lineIndex] ?? "";

		// Skip overly long lines (likely generated/minified)
		if (line.length > MAX_LINE_LENGTH) {
			lineIndex++;
			// If we have accumulated content, don't reset start line
			if (currentChunkLines.length === 0) {
				chunkStartLine = lineIndex + 1;
			}
			continue;
		}

		const lineTokens = estimateTokens(`${line}\n`);

		// Check if adding this line would exceed target
		if (
			currentTokenCount + lineTokens > TARGET_TOKENS &&
			currentChunkLines.length > 0
		) {
			// Emit current chunk
			const chunkText = currentChunkLines.join("\n");
			chunks.push({
				contentHash: hashContent(chunkText),
				text: chunkText,
				tokenCount: currentTokenCount,
				startLine: chunkStartLine,
				endLine: chunkStartLine + currentChunkLines.length - 1,
			});

			// Calculate overlap: find how many lines to keep
			const overlapLines = findOverlapLines(currentChunkLines, OVERLAP_TOKENS);
			const linesToKeep = currentChunkLines.slice(-overlapLines);

			// Reset for next chunk with overlap
			currentChunkLines = linesToKeep;
			currentTokenCount = estimateTokens(linesToKeep.join("\n"));
			chunkStartLine = chunkStartLine + currentChunkLines.length - overlapLines;
		}

		currentChunkLines.push(line);
		currentTokenCount += lineTokens;
		lineIndex++;
	}

	// Emit final chunk if there's remaining content
	if (currentChunkLines.length > 0) {
		const chunkText = currentChunkLines.join("\n");
		chunks.push({
			contentHash: hashContent(chunkText),
			text: chunkText,
			tokenCount: currentTokenCount,
			startLine: chunkStartLine,
			endLine: chunkStartLine + currentChunkLines.length - 1,
		});
	}

	return chunks;
}

/**
 * Find how many lines from the end to keep for overlap.
 */
function findOverlapLines(lines: string[], targetTokens: number): number {
	let tokens = 0;
	let count = 0;

	for (let i = lines.length - 1; i >= 0 && tokens < targetTokens; i--) {
		const line = lines[i];
		if (line !== undefined) {
			tokens += estimateTokens(`${line}\n`);
			count++;
		}
	}

	return count;
}
