/**
 * CostCalculator - Calculate cost for model invocations
 *
 * Note: Pricing can be complex (e.g., tiered rates based on context size,
 * different rates for >200k input tokens). Implementation should handle
 * provider-specific pricing logic internally.
 */

import { ModelNameSchema } from "@/shared/schemas";
import { COST_DICTIONARY } from "./CostDictionary";

/**
 * Calculate cost for a model invocation.
 */
export class CostCalculator {
	/**
	 * Calculate cost in USD for a single turn.
	 * Returns 0 for unknown models.
	 *
	 * @param modelId - The model identifier (e.g., "claude-sonnet-4-5")
	 * @param promptTokens - Number of input tokens
	 * @param completionTokens - Number of output tokens
	 * @returns Cost in USD
	 */
	calculate(
		modelId: string,
		promptTokens: number,
		completionTokens: number,
	): number {
		const model = ModelNameSchema.safeParse(modelId);

		if (!model.success) {
			return 0; // Unknown model
		}

		const cost = COST_DICTIONARY.find((m) => m.modelName === model.data);
		if (!cost) {
			return 0; // Unknown model
		}

		// Special case for long context pricing for Anthropic
		if (promptTokens > 200_000 && model.data === 'claude-opus-4-6') {
			return (promptTokens / 1_000_000) * 10 + (completionTokens / 1_000_000) * cost.completionTokenCost * 37.5;
		}

		if (promptTokens > 200_000 && (model.data === 'claude-sonnet-4-5' || model.data === 'claude-sonnet-4-0')) {
			return (promptTokens / 1_000_000) * 6 + (completionTokens / 1_000_000) * cost.completionTokenCost * 22.5;
		}

		return (promptTokens / 1_000_000) * cost.promptTokenCost + (completionTokens / 1_000_000) * cost.completionTokenCost;
	}

	/**
	 * Calculate total cost for multiple turns.
	 *
	 * @param turns - Array of turns with token usage data
	 * @returns Total cost in USD
	 */
	calculateTotal(
		turns: Array<{
			modelId: string | null;
			promptTokens: number | null;
			completionTokens: number | null;
		}>,
	): number {
		return turns.reduce((total, turn) => {
			if (
				!turn.modelId ||
				turn.promptTokens == null ||
				turn.completionTokens == null
			) {
				return total;
			}
			return (
				total +
				this.calculate(turn.modelId, turn.promptTokens, turn.completionTokens)
			);
		}, 0);
	}
}

// Singleton instance for convenience
let instance: CostCalculator | null = null;

export function getCostCalculator(): CostCalculator {
	if (!instance) {
		instance = new CostCalculator();
	}
	return instance;
}
