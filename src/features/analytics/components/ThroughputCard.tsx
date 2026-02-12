/**
 * ThroughputCard - Workflow throughput over time
 *
 * Displays a table of date and count pairs showing daily workflow completions.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAnalyticsStore } from "../store/analyticsStore";
import { formatNumber } from "../utils/format";

export function ThroughputCard() {
	const { data, loading, error } = useAnalyticsStore((s) => s.throughput);

	return (
		<Card>
			<CardHeader>
				<CardTitle>Throughput</CardTitle>
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
								<th className="py-2 text-left font-medium">Date</th>
								<th className="py-2 text-right font-medium">Completions</th>
							</tr>
						</thead>
						<tbody>
							{data.map((entry) => (
								<tr key={entry.date} className="border-b last:border-0">
									<td className="py-2">{entry.date}</td>
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
