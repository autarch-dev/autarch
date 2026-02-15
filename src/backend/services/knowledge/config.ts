/**
 * Knowledge Service Configuration
 *
 * Centralized configuration constants for the knowledge injection and search
 * systems. All similarity thresholds and budget limits are defined here to
 * prevent drift between modules.
 */

export const KNOWLEDGE_CONFIG = {
	/** Minimum similarity score for auto-injected knowledge items during workflow transitions. */
	INJECTION_SIMILARITY_THRESHOLD: 0.7,

	/** Maximum estimated tokens for the knowledge section per workflow transition. */
	CONTEXT_BUDGET_TOKENS: 3000,

	/** Minimum similarity score for manual knowledge search results. */
	SEARCH_SIMILARITY_THRESHOLD: 0.5,
} as const;
