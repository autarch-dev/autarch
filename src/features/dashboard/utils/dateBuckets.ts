/**
 * Date bucketing utility for grouping timestamped items into human-readable
 * time-based categories (Today, Yesterday, This Week, etc.).
 *
 * Bucket boundaries are computed relative to Date.now() using the user's
 * local timezone. Only non-empty buckets are included in the output.
 */

/** Ordered label for each date bucket */
export type DateBucketLabel =
	| "Today"
	| "Yesterday"
	| "This Week"
	| "Last Week"
	| "This Month"
	| "Last Month"
	| "Earlier";

/** A single date bucket containing its label and matching items */
export interface DateBucket<T> {
	label: DateBucketLabel;
	items: T[];
}

/**
 * Returns the start of day (midnight) for a given date in local timezone.
 */
function startOfDay(date: Date): Date {
	const d = new Date(date);
	d.setHours(0, 0, 0, 0);
	return d;
}

/**
 * Returns the start of the current week (Monday at midnight) for a given date
 * in local timezone.
 */
function startOfWeek(date: Date): Date {
	const d = startOfDay(date);
	const day = d.getDay();
	// getDay() returns 0 for Sunday, 1 for Monday, etc.
	// Shift so Monday = 0: (day + 6) % 7 gives days since Monday
	const daysSinceMonday = (day + 6) % 7;
	d.setDate(d.getDate() - daysSinceMonday);
	return d;
}

/**
 * Returns the start of the month (1st at midnight) for a given date in local
 * timezone.
 */
function startOfMonth(date: Date): Date {
	const d = new Date(date);
	d.setDate(1);
	d.setHours(0, 0, 0, 0);
	return d;
}

/**
 * Groups items into ordered date buckets based on their timestamps.
 *
 * @param items - Array of items to group
 * @param getTimestamp - Accessor function returning epoch milliseconds for an item
 * @returns Ordered array of non-empty date buckets with items sorted descending
 *   by timestamp within each bucket
 */
export function groupByDateBucket<T>(
	items: T[],
	getTimestamp: (item: T) => number,
): DateBucket<T>[] {
	const now = new Date(Date.now());

	const todayStart = startOfDay(now);
	const yesterdayStart = new Date(todayStart);
	yesterdayStart.setDate(yesterdayStart.getDate() - 1);

	const thisWeekStart = startOfWeek(now);
	const lastWeekStart = new Date(thisWeekStart);
	lastWeekStart.setDate(lastWeekStart.getDate() - 7);

	const thisMonthStart = startOfMonth(now);
	const lastMonthStart = new Date(thisMonthStart);
	lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);

	const buckets: { label: DateBucketLabel; minTime: number; items: T[] }[] = [
		{ label: "Today", minTime: todayStart.getTime(), items: [] },
		{ label: "Yesterday", minTime: yesterdayStart.getTime(), items: [] },
		{ label: "This Week", minTime: thisWeekStart.getTime(), items: [] },
		{ label: "Last Week", minTime: lastWeekStart.getTime(), items: [] },
		{ label: "This Month", minTime: thisMonthStart.getTime(), items: [] },
		{ label: "Last Month", minTime: lastMonthStart.getTime(), items: [] },
		{ label: "Earlier", minTime: -Infinity, items: [] },
	];

	for (const item of items) {
		const ts = getTimestamp(item);
		const bucket = buckets.find((b) => ts >= b.minTime);
		if (bucket) {
			bucket.items.push(item);
		}
	}

	const sortDescending = (a: T, b: T) => getTimestamp(b) - getTimestamp(a);

	return buckets
		.filter((bucket) => bucket.items.length > 0)
		.map((bucket) => ({
			label: bucket.label,
			items: bucket.items.sort(sortDescending),
		}));
}
