/**
 * Shared formatting helpers for the knowledge feature.
 */

import type { KnowledgeCategory } from "@/shared/schemas/knowledge";

/** Map category to Badge variant */
export function categoryVariant(
	category: KnowledgeCategory,
): "default" | "secondary" | "outline" | "destructive" {
	switch (category) {
		case "pattern":
			return "default";
		case "gotcha":
			return "secondary";
		case "tool-usage":
			return "outline";
		case "process-improvement":
			return "destructive";
		default:
			return "default";
	}
}

/** Truncate text to a given length with ellipsis */
export function truncate(text: string, maxLength = 150): string {
	if (text.length <= maxLength) return text;
	return `${text.slice(0, maxLength).trimEnd()}…`;
}
