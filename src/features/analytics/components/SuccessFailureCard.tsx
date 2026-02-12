/**
 * SuccessFailureCard - Workflow status breakdown
 *
 * Displays a summary table of workflow counts per status (completed, errored, etc.)
 * with percentage calculations relative to the total.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAnalyticsStore } from "../store/analyticsStore";
import { formatNumber } from "../utils/format";

export function SuccessFailureCard() {
	const { data, loading, error } = useAnalyticsStore((s) => s.summary);

	const total = (data ?? []).reduce((sum, entry) => sum + entry.count, 0);

	return (
		<Card>
			<CardHeader>
				<CardTitle>Success / Failure Rates</CardTitle>
			</CardHeader>
			<CardContent>
				{loading ? (
					<p className="text-muted-foreground">Loading...</p>
				) : error ? (
					<p className="text-destructive text-sm">{error}</p>
				) : !data || data.length === 0 ? (
					<p className="text-muted-foreground">No data</p>
				) : (
					<div className="space-y-3">
						<p className="text-sm text-muted-foreground">
							Total workflows: {formatNumber(total)}
						</p>
						<table className="w-full text-sm">
							<thead>
								<tr className="border-b">
									<th className="py-2 text-left font-medium">Status</th>
									<th className="py-2 text-right font-medium">Count</th>
									<th className="py-2 text-right font-medium">%</th>
								</tr>
							</thead>
							<tbody>
								{data.map((entry) => (
									<tr key={entry.status} className="border-b last:border-0">
										<td className="py-2 capitalize">{entry.status}</td>
										<td className="py-2 text-right">
											{formatNumber(entry.count)}
										</td>
										<td className="py-2 text-right text-muted-foreground">
											{total > 0
												? ((entry.count / total) * 100).toFixed(1)
												: "0.0"}
											%
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
