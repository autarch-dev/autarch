/**
 * FailurePatternCard - Failure pattern analysis
 *
 * Three sub-sections: failures by stage, failures by error type, and pulse
 * failures. Each displays items sorted by count descending.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAnalyticsStore } from "../store/analyticsStore";

/** Format a number with comma separators */
function formatNumber(n: number): string {
	return n.toLocaleString();
}

export function FailurePatternCard() {
	const { data, loading, error } = useAnalyticsStore((s) => s.failures);

	return (
		<Card>
			<CardHeader>
				<CardTitle>Failure Patterns</CardTitle>
			</CardHeader>
			<CardContent>
				{loading ? (
					<p className="text-muted-foreground">Loading...</p>
				) : error ? (
					<p className="text-destructive text-sm">{error}</p>
				) : !data ? (
					<p className="text-muted-foreground">No data</p>
				) : (
					<div className="space-y-6">
						{/* Failures by Stage */}
						<div>
							<h3 className="mb-2 text-sm font-medium">By Stage</h3>
							{data.byStage.length === 0 ? (
								<p className="text-muted-foreground text-sm">No failures</p>
							) : (
								<table className="w-full text-sm">
									<thead>
										<tr className="border-b">
											<th className="py-2 text-left font-medium">Stage</th>
											<th className="py-2 text-left font-medium">Error Type</th>
											<th className="py-2 text-right font-medium">Count</th>
										</tr>
									</thead>
									<tbody>
										{[...data.byStage]
											.sort((a, b) => b.count - a.count)
											.map((entry, idx) => (
												<tr
													key={`${entry.stage}-${entry.errorType}-${idx}`}
													className="border-b last:border-0"
												>
													<td className="py-2">{entry.stage}</td>
													<td className="py-2">{entry.errorType}</td>
													<td className="py-2 text-right">
														{formatNumber(entry.count)}
													</td>
												</tr>
											))}
									</tbody>
								</table>
							)}
						</div>

						{/* Failures by Error Type */}
						<div>
							<h3 className="mb-2 text-sm font-medium">By Error Type</h3>
							{data.byErrorType.length === 0 ? (
								<p className="text-muted-foreground text-sm">No failures</p>
							) : (
								<table className="w-full text-sm">
									<thead>
										<tr className="border-b">
											<th className="py-2 text-left font-medium">Error Type</th>
											<th className="py-2 text-right font-medium">Count</th>
										</tr>
									</thead>
									<tbody>
										{[...data.byErrorType]
											.sort((a, b) => b.count - a.count)
											.map((entry) => (
												<tr
													key={entry.errorType}
													className="border-b last:border-0"
												>
													<td className="py-2">{entry.errorType}</td>
													<td className="py-2 text-right">
														{formatNumber(entry.count)}
													</td>
												</tr>
											))}
									</tbody>
								</table>
							)}
						</div>

						{/* Pulse Failures */}
						<div>
							<h3 className="mb-2 text-sm font-medium">Pulse Failures</h3>
							{data.pulseFailures.length === 0 ? (
								<p className="text-muted-foreground text-sm">No failures</p>
							) : (
								<table className="w-full text-sm">
									<thead>
										<tr className="border-b">
											<th className="py-2 text-left font-medium">Reason</th>
											<th className="py-2 text-right font-medium">Count</th>
										</tr>
									</thead>
									<tbody>
										{[...data.pulseFailures]
											.sort((a, b) => b.count - a.count)
											.map((entry) => (
												<tr
													key={entry.failureReason}
													className="border-b last:border-0"
												>
													<td className="py-2 max-w-xs truncate">
														{entry.failureReason}
													</td>
													<td className="py-2 text-right">
														{formatNumber(entry.count)}
													</td>
												</tr>
											))}
									</tbody>
								</table>
							)}
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
