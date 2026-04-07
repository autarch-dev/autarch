/**
 * TrendChart - Cost over time
 *
 * Recharts LineChart displaying total cost (USD) and $/mTok per date.
 * Uses dual Y-axes: left for cost, right for $/mTok.
 */

import {
	Area,
	AreaChart,
	CartesianGrid,
	Line,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCostStore } from "../store/costStore";

export function TrendChart() {
	const { data, loading, error } = useCostStore((s) => s.trends);

	const chartData = (data ?? []).map((entry) => {
		const totalTokens = entry.promptTokens + entry.completionTokens;
		return {
			date: entry.date,
			cost: entry.totalCost,
			costPerMTok:
				totalTokens > 0
					? Number(((entry.totalCost / totalTokens) * 1_000_000).toFixed(2))
					: null,
		};
	});

	return (
		<Card>
			<CardHeader>
				<CardTitle>Cost Trend</CardTitle>
			</CardHeader>
			<CardContent>
				{loading ? (
					<p className="text-muted-foreground">Loading...</p>
				) : error ? (
					<p className="text-destructive text-sm">{error}</p>
				) : chartData.length === 0 ? (
					<p className="text-muted-foreground">No data</p>
				) : (
					<ResponsiveContainer width="100%" height={300}>
						<AreaChart data={chartData}>
							<CartesianGrid strokeDasharray="3 3" />
							<XAxis dataKey="date" />
							<YAxis yAxisId="cost" />
							<YAxis yAxisId="rate" orientation="right" />
							<Tooltip
								formatter={(value, name) => {
									if (name === "cost")
										return [`$${Number(value).toFixed(2)}`, "Cost"];
									return [`$${Number(value).toFixed(2)}`, "$/mTok"];
								}}
							/>
							<Area
								yAxisId="cost"
								type="monotone"
								dataKey="cost"
								stroke="#6366f1"
								fill="#6366f1"
								fillOpacity={0.2}
							/>
							<Line
								yAxisId="rate"
								type="monotone"
								dataKey="costPerMTok"
								stroke="#f59e0b"
								strokeWidth={2}
								dot={false}
								connectNulls
							/>
						</AreaChart>
					</ResponsiveContainer>
				)}
			</CardContent>
		</Card>
	);
}
