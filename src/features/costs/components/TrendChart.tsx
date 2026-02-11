/**
 * TrendChart - Cost over time
 *
 * Recharts LineChart displaying total cost (USD) per date.
 * Uses a single line with area fill for visual emphasis.
 */

import {
	Area,
	AreaChart,
	CartesianGrid,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCostStore } from "../store/costStore";

export function TrendChart() {
	const { data, loading } = useCostStore((s) => s.trends);

	const chartData = (data ?? []).map((entry) => ({
		date: entry.date,
		cost: entry.totalCost,
	}));

	return (
		<Card>
			<CardHeader>
				<CardTitle>Cost Trend</CardTitle>
			</CardHeader>
			<CardContent>
				{loading ? (
					<p className="text-muted-foreground">Loading...</p>
				) : chartData.length === 0 ? (
					<p className="text-muted-foreground">No data</p>
				) : (
					<ResponsiveContainer width="100%" height={300}>
						<AreaChart data={chartData}>
							<CartesianGrid strokeDasharray="3 3" />
							<XAxis dataKey="date" />
							<YAxis />
							<Tooltip
								formatter={(value) => [`$${Number(value).toFixed(2)}`, "Cost"]}
							/>
							<Area
								type="monotone"
								dataKey="cost"
								stroke="#6366f1"
								fill="#6366f1"
								fillOpacity={0.2}
							/>
						</AreaChart>
					</ResponsiveContainer>
				)}
			</CardContent>
		</Card>
	);
}
