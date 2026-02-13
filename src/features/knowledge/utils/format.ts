/**
 * Shared formatting helpers and category configuration for the knowledge feature.
 */

import type { KnowledgeCategory } from "@/shared/schemas/knowledge";

// =============================================================================
// Category Configuration
// =============================================================================

interface CategoryConfig {
	label: string;
	dot: string;
	pill: string;
	border: string;
	activeRing: string;
}

/**
 * Visual configuration for each knowledge category.
 * Used across cards, pills, timeline dots, and filter toggles.
 */
export const CATEGORY_CONFIG = {
	pattern: {
		label: "Pattern",
		dot: "bg-blue-500",
		pill: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
		border: "border-l-blue-500",
		activeRing: "ring-blue-500/30 bg-blue-500/10",
	},
	gotcha: {
		label: "Gotcha",
		dot: "bg-amber-500",
		pill: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
		border: "border-l-amber-500",
		activeRing: "ring-amber-500/30 bg-amber-500/10",
	},
	"tool-usage": {
		label: "Tool Usage",
		dot: "bg-violet-500",
		pill: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
		border: "border-l-violet-500",
		activeRing: "ring-violet-500/30 bg-violet-500/10",
	},
	"process-improvement": {
		label: "Improvement",
		dot: "bg-emerald-500",
		pill: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
		border: "border-l-emerald-500",
		activeRing: "ring-emerald-500/30 bg-emerald-500/10",
	},
} as const satisfies Record<KnowledgeCategory, CategoryConfig>;

// =============================================================================
// Text Helpers
// =============================================================================

/** Truncate text to a given length with ellipsis */
export function truncate(text: string, maxLength = 150): string {
	if (text.length <= maxLength) return text;
	return `${text.slice(0, maxLength).trimEnd()}…`;
}

/** Format a timestamp as a relative "time ago" string */
export function timeAgo(timestamp: number): string {
	const seconds = Math.floor((Date.now() - timestamp) / 1000);
	if (seconds < 60) return "just now";
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	if (days < 7) return `${days}d ago`;
	const weeks = Math.floor(days / 7);
	if (weeks < 5) return `${weeks}w ago`;
	const months = Math.floor(days / 30);
	return `${months}mo ago`;
}
