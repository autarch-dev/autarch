/**
 * CostCalculator - Calculate cost for model invocations
 *
 * Note: Pricing can be complex (e.g., tiered rates based on context size,
 * different rates for >200k input tokens). Implementation should handle
 * provider-specific pricing logic internally.
 */

import { log } from "@/backend/logger";
import { ModelNameSchema } from "@/shared/schemas";
import {
	COST_DICTIONARY,
	type CostParams,
	type TieredCostParams,
} from "./CostDictionary";

/**
 * Calculate cost for a model invocation.
 */
export class CostCalculator {
	/**
	 * Calculate cost in USD for a single turn.
	 * Returns 0 for unknown models or misconfigured pricing models.
	 *
	 * @param modelId - The model identifier (e.g., "claude-sonnet-4-5")
	 * @param uncachedPromptTokens - Number of uncached input tokens
	 * @param completionTokens - Number of output tokens
	 * @param cacheWriteTokens - Number of cache write tokens
	 * @param cacheReadTokens - Number of cache read tokens
	 * @returns Cost in USD
	 */
	calculate(
		modelId: string,
		uncachedPromptTokens: number,
		completionTokens: number,
		cacheWriteTokens: number | undefined,
		cacheReadTokens: number | undefined,
	): number {
		const model = ModelNameSchema.safeParse(modelId);

		if (!model.success) {
			return 0; // Unknown model
		}

		const cost = COST_DICTIONARY.find((m) => m.modelName === model.data);
		if (!cost) {
			return 0; // Unknown model
		}

		if ("pricingTiers" in cost) {
			return this.calculateTieredCost(
				modelId,
				cost.pricingTiers,
				uncachedPromptTokens,
				completionTokens,
				cacheWriteTokens,
				cacheReadTokens,
			);
		}

		return this.calculateSimpleCost(
			modelId,
			cost,
			uncachedPromptTokens,
			completionTokens,
			cacheWriteTokens,
			cacheReadTokens,
		);
	}

	private calculateTieredCost(
		modelId: string,
		tiers: TieredCostParams[],
		uncachedPromptTokens: number,
		completionTokens: number,
		cacheWriteTokens: number | undefined,
		cacheReadTokens: number | undefined,
	): number {
		const totalInputTokens = uncachedPromptTokens +
			(cacheReadTokens ?? 0) +
			(cacheWriteTokens ?? 0);

		for (const tier of tiers) {
			const doesMeetMinimum = typeof tier.minimumTokens === 'number'
				? totalInputTokens >= tier.minimumTokens
				: true;
			const doesMeetMaximum = typeof tier.maximumTokens === 'number'
				? totalInputTokens <= tier.maximumTokens
				: true;

			if (doesMeetMinimum && doesMeetMaximum) {
				return this.calculateSimpleCost(
					modelId,
					tier,
					uncachedPromptTokens,
					completionTokens,
					cacheWriteTokens,
					cacheReadTokens,
				);
			}
		}

		log.agent.warn(
			`Cannot calculate cost: no tier found for ${modelId} with ${uncachedPromptTokens} uncached prompt tokens, ${completionTokens} completion tokens, ${cacheWriteTokens} cache write tokens, and ${cacheReadTokens} cache read tokens`,
		);

		return 0;
	}

	private calculateSimpleCost(
		modelId: string,
		cost: CostParams,
		uncachedPromptTokens: number,
		completionTokens: number,
		cacheWriteTokens: number | undefined,
		cacheReadTokens: number | undefined,
	): number {
		if (cacheReadTokens && !cost.cacheReadCost) {
			log.agent.warn(
				`Cannot calculate accurate cost: cache read cost is not set for ${modelId}`,
			);
		}

		if (cacheWriteTokens && !cost.cacheWriteCost) {
			log.agent.warn(
				`Cannot calculate accurate cost: cache write cost is not set for ${modelId}`,
			);
		}

		return (
			(uncachedPromptTokens / 1_000_000) * cost.promptTokenCost +
			(completionTokens / 1_000_000) * cost.completionTokenCost +
			((cacheWriteTokens ?? 0) / 1_000_000) * (cost.cacheWriteCost ?? cost.promptTokenCost) +
			((cacheReadTokens ?? 0) / 1_000_000) * (cost.cacheReadCost ?? cost.promptTokenCost)
		);
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
