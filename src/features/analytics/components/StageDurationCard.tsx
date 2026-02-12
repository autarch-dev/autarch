/**
 * StageDurationCard - Stage duration breakdown
 *
 * Displays a table of stage names with average durations (formatted as
 * human-readable time) and transition counts.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAnalyticsStore } from "../store/analyticsStore";

/** Format seconds into a human-readable duration string */
function formatDuration(seconds: number): string {
	if (seconds < 60) {
		return `${seconds.toFixed(1)}s`;
	}
	if (seconds < 3600) {
		const mins = Math.floor(seconds / 60);
		const secs = Math.round(seconds % 60);
		return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
	}
	const hours = Math.floor(seconds / 3600);
	const mins = Math.round((seconds % 3600) / 60);
	return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

/** Format a number with comma separators */
function formatNumber(n: number): string {
	return n.toLocaleString();
}

export function StageDurationCard() {
	const { data, loading, error } = useAnalyticsStore((s) => s.stages);

	return (
		<Card>
			<CardHeader>
				<CardTitle>Stage Durations</CardTitle>
			</CardHeader>
			<CardContent>
				{loading ? (
					<p className="text-muted-foreground">Loading...</p>
				) : error ? (
					<p className="text-destructive text-sm">{error}</p>
				) : !data || data.length === 0 ? (
					<p className="text-muted-foreground">No data</p>
				) : (
					<table className="w-full text-sm">
						<thead>
							<tr className="border-b">
								<th className="py-2 text-left font-medium">Stage</th>
								<th className="py-2 text-right font-medium">Avg Duration</th>
								<th className="py-2 text-right font-medium">Transitions</th>
							</tr>
						</thead>
						<tbody>
							{data.map((entry) => (
								<tr key={entry.stage} className="border-b last:border-0">
									<td className="py-2">{entry.stage}</td>
									<td className="py-2 text-right">
										{formatDuration(entry.avgDuration)}
									</td>
									<td className="py-2 text-right">
										{formatNumber(entry.count)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				)}
			</CardContent>
		</Card>
	);
}
