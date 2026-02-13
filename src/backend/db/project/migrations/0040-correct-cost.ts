import { type Kysely, sql } from "kysely";
import type { ProjectDatabase } from "../types";

/**
 * Fix cost_usd values that were inflated by a bug in CostCalculator's
 * long-context pricing path.
 *
 * The bug: output token cost was computed as
 *   (completionTokens / 1_000_000) * cost.completionTokenCost * LONG_CONTEXT_RATE
 * instead of
 *   (completionTokens / 1_000_000) * LONG_CONTEXT_RATE
 *
 * This double-multiplied the base completion rate into the long-context rate:
 *   - claude-opus-4-6:   25 * 37.5 = 937.5  instead of 37.5  (25x overcharge)
 *   - claude-sonnet-4-5: 15 * 22.5 = 337.5  instead of 22.5  (15x overcharge)
 *   - claude-sonnet-4-0: 15 * 22.5 = 337.5  instead of 22.5  (15x overcharge)
 *
 * Only rows with prompt_tokens > 200,000 hit the long-context code path.
 * We recalculate cost_usd from the stored token counts using the correct rates.
 *
 * Correct long-context pricing:
 *   claude-opus-4-6:     input $10/MTok, output $37.50/MTok
 *   claude-sonnet-4-5/0: input  $6/MTok, output $22.50/MTok
 */
export async function migrate(db: Kysely<ProjectDatabase>): Promise<void> {
	// Fix Opus 4.6 long-context records
	// Correct cost = (prompt_tokens / 1e6) * 10 + (completion_tokens / 1e6) * 37.5
	await sql`
		UPDATE cost_records
		SET cost_usd = (prompt_tokens / 1000000.0) * 10.0
		              + (completion_tokens / 1000000.0) * 37.5
		WHERE model_id = 'claude-opus-4-6'
		  AND prompt_tokens > 200000
	`.execute(db);

	// Fix Sonnet 4.5 long-context records
	// Correct cost = (prompt_tokens / 1e6) * 6 + (completion_tokens / 1e6) * 22.5
	await sql`
		UPDATE cost_records
		SET cost_usd = (prompt_tokens / 1000000.0) * 6.0
		              + (completion_tokens / 1000000.0) * 22.5
		WHERE model_id = 'claude-sonnet-4-5'
		  AND prompt_tokens > 200000
	`.execute(db);

	// Fix Sonnet 4.0 long-context records
	await sql`
		UPDATE cost_records
		SET cost_usd = (prompt_tokens / 1000000.0) * 6.0
		              + (completion_tokens / 1000000.0) * 22.5
		WHERE model_id = 'claude-sonnet-4-0'
		  AND prompt_tokens > 200000
	`.execute(db);
}
