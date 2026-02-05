/**
 * CostCalculator - Calculate cost for model invocations
 *
 * Note: Pricing can be complex (e.g., tiered rates based on context size,
 * different rates for >200k input tokens). Implementation should handle
 * provider-specific pricing logic internally.
 */

import { ModelNameSchema } from "@/shared/schemas";

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

		switch (model.data) {
			case "claude-opus-4-6":
			case "claude-opus-4-5": {
				const inputCost = (promptTokens / 1_000_000) * 5.0;
				const outputCost = (completionTokens / 1_000_000) * 25.0;
				return inputCost + outputCost;
			}

			case "claude-sonnet-4-5": {
				const inputCost =
					(promptTokens / 1_000_000) * (promptTokens > 200_000 ? 6.0 : 3.0);
				const outputCost =
					(completionTokens / 1_000_000) *
					(completionTokens > 200_000 ? 22.5 : 15.0);
				return inputCost + outputCost;
			}

			case "claude-haiku-4-5": {
				const inputCost = (promptTokens / 1_000_000) * 1.0;
				const outputCost = (completionTokens / 1_000_000) * 5.0;
				return inputCost + outputCost;
			}

			default: {
				return 0; // Unimplemented cost model
			}
		}
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
