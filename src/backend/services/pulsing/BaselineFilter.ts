/**
 * BaselineFilter - Filters build/lint/test errors against recorded baselines
 *
 * After shell commands (build/lint/test), this service parses output to
 * identify errors and filters out any that match recorded baselines.
 */

import type {
	PreflightBaseline,
	PulseRepository,
} from "@/backend/repositories/PulseRepository";

// =============================================================================
// Types
// =============================================================================

export interface ParsedError {
	message: string;
	filePath?: string;
	line?: number;
	code?: string;
	severity: "error" | "warning";
}

export interface FilteredOutput {
	/** Original output */
	original: string;
	/** Errors that are NOT in baseline (new errors) */
	newErrors: ParsedError[];
	/** Errors that ARE in baseline (filtered out) */
	baselineErrors: ParsedError[];
	/** Whether there are new errors */
	hasNewErrors: boolean;
}

// =============================================================================
// Error Parsing
// =============================================================================

/**
 * Parse common error formats from build output
 *
 * Handles formats like:
 * - file.ts(10,5): error TS2304: Cannot find name 'foo'
 * - file.ts:10:5 - error TS2304: Cannot find name 'foo'
 * - error: some error message
 * - warning: some warning message
 */
function parseErrors(output: string): ParsedError[] {
	const errors: ParsedError[] = [];

	// Split by lines and process
	const lines = output.split("\n");

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed) continue;

		// Try different patterns

		// Pattern 1: TypeScript/C# style: file.ts(10,5): error TS2304: message
		const tsMatch = trimmed.match(
			/^(.+?)\((\d+),(\d+)\):\s*(error|warning)\s+(\w+):\s*(.+)$/i,
		);
		if (tsMatch?.[1] && tsMatch[2] && tsMatch[4] && tsMatch[5] && tsMatch[6]) {
			errors.push({
				filePath: tsMatch[1],
				line: Number.parseInt(tsMatch[2], 10),
				severity: tsMatch[4].toLowerCase() as "error" | "warning",
				code: tsMatch[5],
				message: tsMatch[6],
			});
			continue;
		}

		// Pattern 2: ESLint/common style: file.ts:10:5 - error TS2304: message
		const eslintMatch = trimmed.match(
			/^(.+?):(\d+):(\d+)\s*[-–]\s*(error|warning)\s+(.+)$/i,
		);
		if (
			eslintMatch?.[1] &&
			eslintMatch[2] &&
			eslintMatch[4] &&
			eslintMatch[5]
		) {
			errors.push({
				filePath: eslintMatch[1],
				line: Number.parseInt(eslintMatch[2], 10),
				severity: eslintMatch[4].toLowerCase() as "error" | "warning",
				message: eslintMatch[5],
			});
			continue;
		}

		// Pattern 3: Simple error/warning prefix
		const simpleMatch = trimmed.match(/^(error|warning):\s*(.+)$/i);
		if (simpleMatch?.[1] && simpleMatch[2]) {
			errors.push({
				severity: simpleMatch[1].toLowerCase() as "error" | "warning",
				message: simpleMatch[2],
			});
			continue;
		}

		// Pattern 4: npm/yarn error with package name
		const npmMatch = trimmed.match(/^npm\s+(ERR!|WARN)\s*(.+)$/i);
		if (npmMatch?.[1] && npmMatch[2]) {
			errors.push({
				severity: npmMatch[1] === "ERR!" ? "error" : "warning",
				message: npmMatch[2],
			});
			continue;
		}

		// Pattern 5: Python traceback (simplified)
		if (trimmed.includes("Error:") || trimmed.includes("Exception:")) {
			const parts = trimmed.split(/Error:|Exception:/);
			if (parts.length > 1) {
				errors.push({
					severity: "error",
					message: trimmed,
				});
			}
		}
	}

	return errors;
}

/**
 * Check if an error matches a baseline
 */
function matchesBaseline(
	error: ParsedError,
	baseline: PreflightBaseline,
): boolean {
	// Check severity matches
	if (error.severity !== baseline.issueType) {
		return false;
	}

	// Check pattern match
	const errorText = error.code
		? `${error.code}: ${error.message}`
		: error.message;

	if (!errorText.includes(baseline.pattern)) {
		return false;
	}

	// If baseline has file path, check it matches
	if (baseline.filePath && error.filePath) {
		if (!error.filePath.includes(baseline.filePath)) {
			return false;
		}
	}

	return true;
}

// =============================================================================
// BaselineFilter
// =============================================================================

export class BaselineFilter {
	constructor(private pulseRepo: PulseRepository) {}

	/**
	 * Filter shell output against baselines
	 *
	 * @param workflowId - The workflow ID (for fetching baselines)
	 * @param output - The shell output (stdout + stderr)
	 * @param source - The source type (build, lint, test)
	 */
	async filterOutput(
		workflowId: string,
		output: string,
		source: "build" | "lint" | "test",
	): Promise<FilteredOutput> {
		// Parse errors from output
		const allErrors = parseErrors(output);

		// Get baselines for this workflow and source
		const baselines = await this.pulseRepo.getBaselinesBySource(
			workflowId,
			source,
		);

		// Separate into new and baseline errors
		const newErrors: ParsedError[] = [];
		const baselineErrors: ParsedError[] = [];

		for (const error of allErrors) {
			const isBaseline = baselines.some((b) => matchesBaseline(error, b));
			if (isBaseline) {
				baselineErrors.push(error);
			} else {
				newErrors.push(error);
			}
		}

		return {
			original: output,
			newErrors,
			baselineErrors,
			hasNewErrors: newErrors.length > 0,
		};
	}

	/**
	 * Format filtered output for agent consumption
	 *
	 * Returns a string that shows new errors clearly and notes filtered baselines
	 */
	formatFilteredOutput(filtered: FilteredOutput): string {
		let result = filtered.original;

		if (filtered.baselineErrors.length > 0) {
			result += `\n\n--- Baseline Filter Note ---\n`;
			result += `${filtered.baselineErrors.length} issue(s) were filtered as known baselines.\n`;

			if (filtered.newErrors.length === 0) {
				result += "No new issues detected.";
			} else {
				result += `${filtered.newErrors.length} new issue(s) require attention.`;
			}
		}

		return result;
	}

	/**
	 * Check if a specific error message matches any baseline
	 */
	async isBaselineError(
		workflowId: string,
		source: "build" | "lint" | "test",
		errorMessage: string,
		filePath?: string,
	): Promise<boolean> {
		return this.pulseRepo.matchesBaseline(
			workflowId,
			source,
			errorMessage,
			filePath,
		);
	}
}
