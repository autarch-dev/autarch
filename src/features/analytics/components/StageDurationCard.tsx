/**
 * StageDurationCard - Stage duration breakdown
 *
 * Displays a table of stage names with average durations (formatted as
 * human-readable time) and transition counts.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAnalyticsStore } from "../store/analyticsStore";
import { formatDuration, formatNumber } from "../utils/format";

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
