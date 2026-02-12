import type { CostFilters, TimeRangePreset } from "@/shared/schemas/costs";

/**
 * Convert a time-range preset into start/end date filters.
 * Returns an empty object for "all" (no date bounds).
 * Bounded presets return ISO date strings for startDate and endDate.
 */
export function presetToDateRange(
	preset: TimeRangePreset,
): Partial<CostFilters> {
	if (preset === "all") {
		return {};
	}

	const now = new Date();
	const start: Date = new Date(now);
	let end: Date = now;

	switch (preset) {
		case "today": {
			start.setHours(0, 0, 0, 0);
			end = new Date(start);
			end.setHours(23, 59, 59, 999);
			break;
		}
		case "yesterday": {
			start.setDate(start.getDate() - 1);
			start.setHours(0, 0, 0, 0);
			end = new Date(start);
			end.setHours(23, 59, 59, 999);
			break;
		}
		case "last7": {
			start.setDate(start.getDate() - 7);
			start.setHours(0, 0, 0, 0);
			end = new Date(start);
			end.setDate(start.getDate() + 7);
			end.setHours(23, 59, 59, 999);
			break;
		}
		case "last30": {
			start.setDate(start.getDate() - 30);
			start.setHours(0, 0, 0, 0);
			end = new Date(start);
			end.setDate(start.getDate() + 30);
			end.setHours(23, 59, 59, 999);
			break;
		}
		case "last90": {
			start.setDate(start.getDate() - 90);
			start.setHours(0, 0, 0, 0);
			end = new Date(start);
			end.setDate(start.getDate() + 90);
			end.setHours(23, 59, 59, 999);
			break;
		}
	}

	return {
		startDate: start.toISOString().split("T")[0],
		endDate: end.toISOString().split("T")[0],
	};
}

/**
 * Determine the appropriate chart granularity for a time-range preset.
 * Returns "weekly" for larger ranges (last90, all) and "daily" otherwise.
 */
export function granularityForPreset(
	preset: TimeRangePreset,
): "daily" | "weekly" {
	if (preset === "last90" || preset === "all") {
		return "weekly";
	}
	return "daily";
}
