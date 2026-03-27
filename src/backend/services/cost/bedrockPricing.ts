/**
 * Bedrock Pricing Cache
 *
 * Fetches on-demand cross-region inference pricing from the AWS Price List API
 * on app boot and caches it. Pricing is keyed by inference profile ID
 * (e.g. "us.anthropic.claude-sonnet-4-5-v1") → { promptTokenCost, completionTokenCost, cacheReadCost?, cacheWriteCost? }.
 *
 * Costs are in USD per 1M tokens, matching the CostDictionary convention.
 */

import {
	type Filter,
	GetProductsCommand,
	PricingClient,
} from "@aws-sdk/client-pricing";
import { fromNodeProviderChain } from "@aws-sdk/credential-providers";
import { log } from "@/backend/logger";
import type { CostParams } from "./CostDictionary";

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

/** profileId → CostParams (costs per 1M tokens) */
const cache = new Map<string, CostParams>();

export function getBedrockModelCost(profileId: string): CostParams | null {
	return cache.get(profileId) ?? null;
}

// ---------------------------------------------------------------------------
// Fetch & Parse
// ---------------------------------------------------------------------------

interface RawPriceEntry {
	model: string;
	usagetype: string;
	pricePerMillionTokens: number;
}

/**
 * Fetch all Bedrock on-demand cross-region inference pricing from the
 * AWS Price List API and populate the in-memory cache.
 *
 * The Price List API is only available in us-east-1 and ap-south-1.
 */
export async function initBedrockPricing(): Promise<void> {
	try {
		const entries = await fetchPricingEntries();
		buildCache(entries);
		log.server.info(
			`Bedrock pricing cache loaded: ${cache.size} inference profiles`,
		);
	} catch (err) {
		const message =
			err instanceof Error ? err.message : "Unknown error";
		log.server.warn(`Failed to load Bedrock pricing (cost tracking will be unavailable): ${message}`);
	}
}

async function fetchPricingEntries(): Promise<RawPriceEntry[]> {
	const client = new PricingClient({
		region: "us-east-1", // Price List API is only in us-east-1 / ap-south-1
		credentials: fromNodeProviderChain(),
	});

	const filters: Filter[] = [
		{ Type: "TERM_MATCH", Field: "feature", Value: "On-demand Inference" },
		{
			Type: "TERM_MATCH",
			Field: "inferenceType",
			Value: "Cross-region Inference",
		},
	];

	const entries: RawPriceEntry[] = [];
	let nextToken: string | undefined;

	do {
		const command = new GetProductsCommand({
			ServiceCode: "AmazonBedrock",
			Filters: filters,
			FormatVersion: "aws_v1",
			MaxResults: 100,
			NextToken: nextToken,
		});

		const response = await client.send(command);

		for (const raw of response.PriceList ?? []) {
			const parsed = parseProduct(raw);
			if (parsed) entries.push(parsed);
		}

		nextToken = response.NextToken;
	} while (nextToken);

	return entries;
}

/**
 * Parse a single PriceList JSON string into a usable entry.
 * Each product represents either input or output token pricing for one model.
 */
function parseProduct(rawJson: string): RawPriceEntry | null {
	try {
		const product = JSON.parse(rawJson);
		const attrs = product?.product?.attributes;
		if (!attrs?.model || !attrs?.usagetype) return null;

		// Extract the USD price from OnDemand terms
		const onDemandTerms = product?.terms?.OnDemand;
		if (!onDemandTerms) return null;

		for (const termKey of Object.keys(onDemandTerms)) {
			const term = onDemandTerms[termKey];
			const dims = term?.priceDimensions;
			if (!dims) continue;

			for (const dimKey of Object.keys(dims)) {
				const dim = dims[dimKey];
				const usd = dim?.pricePerUnit?.USD;
				if (usd === undefined) continue;

				const price = Number.parseFloat(usd);
				if (Number.isNaN(price)) continue;

				return {
					model: attrs.model,
					usagetype: attrs.usagetype,
					// AWS prices are per-token; convert to per-1M-tokens
					pricePerMillionTokens: price * 1_000_000,
				};
			}
		}
		return null;
	} catch {
		return null;
	}
}

/**
 * Classify a usagetype string into a pricing dimension.
 *
 * usagetype values look like:
 *   "USE1-CrossRegion-Anthropic-Claude-4-5-Sonnet-InputTokens"
 *   "USE1-CrossRegion-Anthropic-Claude-4-5-Sonnet-OutputTokens"
 *   "USE1-CrossRegion-Anthropic-Claude-4-5-Sonnet-CacheReadInputTokens"
 *   "USE1-CrossRegion-Anthropic-Claude-4-5-Sonnet-CacheWriteInputTokens"
 *
 * Order matters: check cache variants before the generic InputToken/OutputToken.
 */
type PriceDimension = "input" | "output" | "cacheRead" | "cacheWrite" | null;

function classifyUsagetype(usagetype: string): PriceDimension {
	if (usagetype.includes("CacheReadInputToken")) return "cacheRead";
	if (usagetype.includes("CacheWriteInputToken")) return "cacheWrite";
	if (usagetype.includes("InputToken")) return "input";
	if (usagetype.includes("OutputToken")) return "output";
	return null;
}

interface ModelPrices {
	input?: number;
	output?: number;
	cacheRead?: number;
	cacheWrite?: number;
}

/**
 * Group raw entries by model ID and build CostParams for each.
 *
 * The model attribute contains the raw model ID (e.g. "anthropic.claude-sonnet-4-5-v1").
 * We store both the raw model ID and the "us." prefixed inference profile ID.
 */
function buildCache(entries: RawPriceEntry[]): void {
	const byModel = new Map<string, ModelPrices>();

	for (const entry of entries) {
		const dimension = classifyUsagetype(entry.usagetype);
		if (!dimension) continue;

		const existing = byModel.get(entry.model) ?? {};
		existing[dimension] = entry.pricePerMillionTokens;
		byModel.set(entry.model, existing);
	}

	cache.clear();
	for (const [modelId, prices] of byModel) {
		if (prices.input === undefined || prices.output === undefined) continue;

		const costParams: CostParams = {
			promptTokenCost: prices.input,
			completionTokenCost: prices.output,
			...(prices.cacheRead !== undefined && { cacheReadCost: prices.cacheRead }),
			...(prices.cacheWrite !== undefined && { cacheWriteCost: prices.cacheWrite }),
		};

		// Store under the raw model ID
		cache.set(modelId, costParams);

		// Also store under the "us." prefixed inference profile ID,
		// which is what the user actually selects
		cache.set(`us.${modelId}`, costParams);
	}
}
