/**
 * OutputComparison - Two-tier comparison for build/test output equivalence
 *
 * Uses a fast-path (exit code + normalized text comparison) first,
 * then falls back to LLM-based equivalence checking for differing outputs.
 * Results are cached to avoid redundant LLM calls.
 */

import { createHash } from "node:crypto";
import { generateObject } from "ai";
import { z } from "zod";
import { getModelForScenario } from "@/backend/llm/models";
import { log } from "@/backend/logger";

// =============================================================================
// Types
// =============================================================================

export interface CommandOutput {
	stdout: string;
	stderr: string;
	exit_code: number;
}

export interface ComparisonResult {
	areEquivalent: boolean;
	isStrictlyImprovement: boolean;
	newIssues: string[];
}

// =============================================================================
// Text Normalization
// =============================================================================

/**
 * Strip variable numbers from output text for deterministic comparison.
 *
 * Removes:
 * - [NNNms] timing patterns
 * - [NN.NNs] second patterns
 * - HH:MM:SS timestamps
 * - ISO8601 timestamps (e.g., 2024-01-15T10:30:45.123Z)
 * - line:col numbers (e.g., :10:5 or (10,5))
 * - Test counts (N passed, N failed, etc.)
 * - Memory sizes (NNmb, NNkb, NNgb)
 *
 * Then normalizes whitespace deterministically.
 */
export function stripNumbers(text: string): string {
	let result = text;

	// Remove [NNNms] timing patterns
	result = result.replace(/\[\d+ms\]/gi, "[Xms]");

	// Remove [NN.NNs] second patterns
	result = result.replace(/\[\d+\.\d+s\]/gi, "[Xs]");

	// Remove standalone timing like "123ms" or "1.5s" (common in test output)
	result = result.replace(/\b\d+(\.\d+)?ms\b/gi, "Xms");
	result = result.replace(/\b\d+(\.\d+)?s\b/gi, "Xs");

	// Remove HH:MM:SS timestamps
	result = result.replace(/\b\d{1,2}:\d{2}:\d{2}\b/g, "HH:MM:SS");

	// Remove ISO8601 timestamps (e.g., 2024-01-15T10:30:45.123Z or 2024-01-15T10:30:45)
	result = result.replace(
		/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?/g,
		"ISO_TIMESTAMP",
	);

	// Remove date patterns like 2024-01-15 or 2024/01/15
	result = result.replace(/\d{4}[-/]\d{2}[-/]\d{2}/g, "DATE");

	// Remove line:col patterns like :10:5 or :123:45
	result = result.replace(/:(\d+):(\d+)/g, ":X:X");

	// Remove (line,col) patterns like (10,5)
	result = result.replace(/\((\d+),(\d+)\)/g, "(X,X)");

	// Remove test counts: "N passed", "N failed", "N skipped", etc.
	result = result.replace(
		/\b\d+\s+(passed|failed|skipped|pending|todo)\b/gi,
		"X $1",
	);

	// Remove test summary patterns like "Tests: 5 passed, 2 failed"
	result = result.replace(/\b\d+\s+(tests?|specs?|suites?)\b/gi, "X $1");

	// Remove memory sizes: NNmb, NNkb, NNgb (case insensitive)
	result = result.replace(/\b\d+(\.\d+)?\s*(mb|kb|gb|bytes?)\b/gi, "X$2");

	// Remove heap/memory usage patterns
	result = result.replace(/\b\d+(\.\d+)?\s*(MB|KB|GB)\b/g, "X$2");

	// Normalize whitespace: collapse multiple spaces/tabs to single space
	result = result.replace(/[ \t]+/g, " ");

	// Normalize line endings and collapse multiple newlines
	result = result.replace(/\r\n/g, "\n");
	result = result.replace(/\n{3,}/g, "\n\n");

	// Trim each line
	result = result
		.split("\n")
		.map((line) => line.trim())
		.join("\n");

	// Trim overall
	result = result.trim();

	return result;
}

// =============================================================================
// OutputComparisonService
// =============================================================================

/**
 * Service for comparing build/test outputs to determine equivalence.
 *
 * Uses a two-tier approach:
 * 1. Fast-path: exit code equality AND normalized text equality
 * 2. LLM-based: semantic comparison for outputs that differ textually
 *
 * Caches successful LLM equivalence determinations to avoid redundant API calls.
 */
export class OutputComparisonService {
	/**
	 * In-memory cache for LLM equivalence results.
	 * Key: SHA256 hash of (workflowId + normalized baseline + normalized current)
	 * Value: Comparison result (only cached when areEquivalent=true)
	 */
	private cache = new Map<string, ComparisonResult>();

	/**
	 * Compare baseline and current command outputs for equivalence.
	 *
	 * @param workflowId - The workflow ID for scoping the comparison
	 * @param command - The command that was run
	 * @param baseline - The baseline output from preflight
	 * @param current - The current output from pulse verification
	 * @returns Comparison result indicating equivalence and any new issues
	 */
	async compareOutputs(
		workflowId: string,
		command: string,
		baseline: CommandOutput,
		current: CommandOutput,
	): Promise<ComparisonResult> {
		// Fast-path rejection: baseline succeeded (exit 0) but current failed (non-zero)
		// with error indicators - this is an obvious regression, skip LLM
		if (baseline.exit_code === 0 && current.exit_code !== 0) {
			if (this.hasErrorIndicators(current)) {
				log.workflow.debug(
					"Fast-path rejection: baseline succeeded but current failed with error indicators",
				);
				return {
					areEquivalent: false,
					isStrictlyImprovement: false,
					newIssues: [
						`Command '${command}' failed (exit code ${current.exit_code}) when baseline succeeded`,
					],
				};
			}
		}

		// Exit codes differ but not obvious regression - need LLM to determine if meaningful
		if (baseline.exit_code !== current.exit_code) {
			return this.llmComparison(workflowId, command, baseline, current);
		}

		// Fast-path: if both exit codes are 0, it was a success, so they're equivalent
		if (baseline.exit_code === 0 && current.exit_code === 0) {
			log.workflow.debug(
				"Fast-path: both exit codes are 0, they're equivalent",
			);
			return {
				areEquivalent: true,
				isStrictlyImprovement: false,
				newIssues: [],
			};
		}

		// Normalize outputs for comparison
		const normalizedBaseline = this.normalizeOutput(baseline);
		const normalizedCurrent = this.normalizeOutput(current);

		// Fast-path: if normalized outputs are identical, they're equivalent
		if (normalizedBaseline === normalizedCurrent) {
			return {
				areEquivalent: true,
				isStrictlyImprovement: false,
				newIssues: [],
			};
		}

		// Outputs differ - check cache then use LLM
		return this.llmComparison(workflowId, command, baseline, current);
	}

	/**
	 * Combine and normalize stdout/stderr for comparison.
	 */
	private normalizeOutput(output: CommandOutput): string {
		const combined = `${output.stdout}\n${output.stderr}`;
		return stripNumbers(combined);
	}

	/**
	 * Check if output contains common error indicators.
	 * Used for fast-path rejection of obvious failures.
	 */
	private hasErrorIndicators(output: CommandOutput): boolean {
		const combined = `${output.stdout}\n${output.stderr}`.toLowerCase();
		const errorPatterns = [
			"error",
			"failed",
			"failure",
			"exception",
			"fatal",
			"panic",
			"cannot",
			"could not",
			"unable to",
		];
		return errorPatterns.some((pattern) => combined.includes(pattern));
	}

	/**
	 * Generate cache key from workflowId and normalized outputs.
	 */
	private getCacheKey(
		workflowId: string,
		baseline: CommandOutput,
		current: CommandOutput,
	): string {
		const normalizedBaseline = this.normalizeOutput(baseline);
		const normalizedCurrent = this.normalizeOutput(current);
		const input = `${workflowId}|${normalizedBaseline}|${normalizedCurrent}`;
		return createHash("sha256").update(input).digest("hex");
	}

	/**
	 * Perform LLM-based equivalence comparison with caching.
	 */
	private async llmComparison(
		workflowId: string,
		command: string,
		baseline: CommandOutput,
		current: CommandOutput,
	): Promise<ComparisonResult> {
		// Check cache first
		const cacheKey = this.getCacheKey(workflowId, baseline, current);
		const cached = this.cache.get(cacheKey);
		if (cached) {
			log.workflow.debug("Using cached LLM comparison result");
			return cached;
		}

		// Call LLM with retry
		const result = await this.checkLlmEquivalence(command, baseline, current);

		// Cache successful (equivalent) results only
		if (result.areEquivalent) {
			this.cache.set(cacheKey, result);
		}

		return result;
	}

	/**
	 * Call LLM to determine if outputs are semantically equivalent.
	 * Implements single retry with exponential backoff on failure.
	 */
	private async checkLlmEquivalence(
		command: string,
		baseline: CommandOutput,
		current: CommandOutput,
	): Promise<ComparisonResult> {
		const schema = z.object({
			areEquivalent: z
				.boolean()
				.describe(
					"Whether the outputs represent equivalent outcomes (same errors, failures, warnings)",
				),
			isStrictlyImprovement: z
				.boolean()
				.describe(
					"Whether the outputs represent _only_ improved outcomes (no regressions, no errors, failures, or warnings)",
				),
			newIssues: z
				.array(z.string())
				.describe(
					"List of new issues found in current output that were not present in baseline",
				),
		});

		const systemPrompt =
			"Compare build/test outputs. Determine if they represent equivalent outcomes. " +
			"Ignore timing differences, test ordering, and cosmetic formatting. " +
			"Focus on actual errors, failures, and warnings. " +
			"Previously failing tests in the Baseline output that are now passing are not considered new issues.";

		const userPrompt = `Baseline output:
stdout:
${baseline.stdout}

stderr:
${baseline.stderr}

exit_code: ${baseline.exit_code}

---

Current output:
stdout:
${current.stdout}

stderr:
${current.stderr}

exit_code: ${current.exit_code}`;

		let lastError: Error | undefined;

		// Try up to 2 times (initial + 1 retry)
		for (let attempt = 0; attempt < 2; attempt++) {
			try {
				if (attempt > 0) {
					// Exponential backoff: wait 1 second before retry
					await new Promise((resolve) => setTimeout(resolve, 1000));
					log.workflow.debug("Retrying LLM comparison after failure");
				}

				const { model } = await getModelForScenario("basic");

				const { object } = await generateObject({
					model,
					schema,
					system: systemPrompt,
					prompt: userPrompt,
				});

				return object;
			} catch (error) {
				lastError = error instanceof Error ? error : new Error(String(error));
				log.workflow.error(
					`LLM comparison failed (attempt ${attempt + 1}):`,
					lastError,
				);
			}
		}

		// Both attempts failed - fall back to treating outputs as non-equivalent
		// This lets the user decide rather than blocking progress entirely
		log.workflow.warn(
			"LLM comparison unavailable after retries, treating outputs as non-equivalent",
		);
		return {
			areEquivalent: false,
			isStrictlyImprovement: false,
			newIssues: [
				`LLM comparison for command '${command}' unavailable - outputs differ and could not be verified. ` +
					"Review the output differences manually.",
			],
		};
	}

	/**
	 * Clear the comparison cache (useful for testing or memory management).
	 */
	clearCache(): void {
		this.cache.clear();
	}
}
