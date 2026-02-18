/**
 * CostCalculator - Calculate cost for model invocations
 *
 * Note: Pricing can be complex (e.g., tiered rates based on context size,
 * different rates for >200k input tokens). Implementation should handle
 * provider-specific pricing logic internally.
 *
 * Supports both built-in models (static COST_DICTIONARY) and custom
 * provider models (costs queried from the database, then cached).
 */

import { log } from "@/backend/logger";
import { ModelNameSchema } from "@/shared/schemas";
import { getCustomModel } from "../customProviders";
import {
	COST_DICTIONARY,
	type CostParams,
	type TieredCostParams,
} from "./CostDictionary";

/**
 * Calculate cost for a model invocation.
 */
export class CostCalculator {
	private customCostCache = new Map<string, CostParams | null>();

	/**
	 * Calculate cost in USD for a single turn.
	 * Checks the static dictionary for built-in models first,
	 * then falls back to custom model cost data from the database.
	 *
	 * Returns 0 for unknown models or misconfigured pricing models.
	 */
	async calculate(
		modelId: string,
		uncachedPromptTokens: number,
		completionTokens: number,
		cacheWriteTokens: number | undefined,
		cacheReadTokens: number | undefined,
	): Promise<number> {
		// Try built-in models first (fast, synchronous path)
		const model = ModelNameSchema.safeParse(modelId);
		if (model.success) {
			const cost = COST_DICTIONARY.find((m) => m.modelName === model.data);
			if (cost) {
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
		}

		// Fall back to custom model cost data
		const customCost = await this.getCustomModelCost(modelId);
		if (customCost) {
			return this.calculateSimpleCost(
				modelId,
				customCost,
				uncachedPromptTokens,
				completionTokens,
				cacheWriteTokens,
				cacheReadTokens,
			);
		}

		return 0;
	}

	private async getCustomModelCost(
		modelId: string,
	): Promise<CostParams | null> {
		if (this.customCostCache.has(modelId)) {
			return this.customCostCache.get(modelId) ?? null;
		}

		const customModel = await getCustomModel(modelId);
		if (!customModel) {
			this.customCostCache.set(modelId, null);
			return null;
		}

		const cost: CostParams = {
			promptTokenCost: customModel.promptTokenCost,
			completionTokenCost: customModel.completionTokenCost,
			cacheReadCost: customModel.cacheReadCost,
			cacheWriteCost: customModel.cacheWriteCost,
		};
		this.customCostCache.set(modelId, cost);
		return cost;
	}

	/** Invalidate the cache when custom model costs are updated. */
	invalidateCustomCostCache(modelId?: string): void {
		if (modelId) {
			this.customCostCache.delete(modelId);
		} else {
			this.customCostCache.clear();
		}
	}

	private calculateTieredCost(
		modelId: string,
		tiers: TieredCostParams[],
		uncachedPromptTokens: number,
		completionTokens: number,
		cacheWriteTokens: number | undefined,
		cacheReadTokens: number | undefined,
	): number {
		const totalInputTokens =
			uncachedPromptTokens + (cacheReadTokens ?? 0) + (cacheWriteTokens ?? 0);

		for (const tier of tiers) {
			const doesMeetMinimum =
				typeof tier.minimumTokens === "number"
					? totalInputTokens >= tier.minimumTokens
					: true;
			const doesMeetMaximum =
				typeof tier.maximumTokens === "number"
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
			((cacheWriteTokens ?? 0) / 1_000_000) *
				(cost.cacheWriteCost ?? cost.promptTokenCost) +
			((cacheReadTokens ?? 0) / 1_000_000) *
				(cost.cacheReadCost ?? cost.promptTokenCost)
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
