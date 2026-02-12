import { z } from "zod";

// =============================================================================
// Analytics Filters
// =============================================================================

export const AnalyticsFiltersSchema = z.object({
	startDate: z.string().optional(),
	endDate: z.string().optional(),
});
export type AnalyticsFilters = z.infer<typeof AnalyticsFiltersSchema>;

// =============================================================================
// Success Failure Rate
// =============================================================================

export const SuccessFailureRateSchema = z.array(
	z.object({
		status: z.string(),
		count: z.number(),
	}),
);
export type SuccessFailureRate = z.infer<typeof SuccessFailureRateSchema>;

// =============================================================================
// Stage Duration
// =============================================================================

export const StageDurationSchema = z.array(
	z.object({
		stage: z.string(),
		avgDuration: z.number(),
		count: z.number(),
	}),
);
export type StageDuration = z.infer<typeof StageDurationSchema>;

// =============================================================================
// Failure Patterns
// =============================================================================

export const FailurePatternsSchema = z.object({
	byStage: z.array(
		z.object({
			stage: z.string(),
			errorType: z.string(),
			count: z.number(),
		}),
	),
	byErrorType: z.array(
		z.object({
			errorType: z.string(),
			count: z.number(),
		}),
	),
	pulseFailures: z.array(
		z.object({
			failureReason: z.string(),
			count: z.number(),
		}),
	),
});
export type FailurePatterns = z.infer<typeof FailurePatternsSchema>;

// =============================================================================
// Throughput
// =============================================================================

export const ThroughputSchema = z.array(
	z.object({
		date: z.string(),
		count: z.number(),
	}),
);
export type Throughput = z.infer<typeof ThroughputSchema>;
