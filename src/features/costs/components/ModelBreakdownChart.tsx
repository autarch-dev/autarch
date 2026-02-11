/**
 * ModelBreakdownChart - Cost breakdown by model
 *
 * Recharts BarChart displaying total cost (USD) per model.
 * Extracts a short display name from the full model_id string.
 */

import {
	Bar,
	BarChart,
	CartesianGrid,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCostStore } from "../store/costStore";

/** Distinct colors for model bars */
const BAR_COLORS = [
	"#6366f1",
	"#f59e0b",
	"#10b981",
	"#ef4444",
	"#8b5cf6",
	"#ec4899",
	"#14b8a6",
	"#f97316",
];

/**
 * Extract a short display name from a full model ID string.
 * e.g. "claude-sonnet-4-5-20250514" → "Sonnet 4.5"
 *      "claude-opus-4-6" → "Opus 4.6"
 *      "claude-haiku-4-5" → "Haiku 4.5"
 */
function shortModelName(modelId: string): string {
	// Try to match claude-{variant}-{major}-{minor} pattern
	const match = modelId.match(/claude-(\w+)-(\d+)-(\d+)/);
	if (match?.[1] && match[2] && match[3]) {
		const variant = match[1].charAt(0).toUpperCase() + match[1].slice(1);
		return `${variant} ${match[2]}.${match[3]}`;
	}
	return modelId;
}

export function ModelBreakdownChart() {
	const { data, loading } = useCostStore((s) => s.byModel);

	const chartData = (data ?? []).map((entry, index) => ({
		name: shortModelName(entry.modelId),
		cost: entry.totalCost,
		fill: BAR_COLORS[index % BAR_COLORS.length],
	}));

	return (
		<Card>
			<CardHeader>
				<CardTitle>Cost by Model</CardTitle>
			</CardHeader>
			<CardContent>
				{loading ? (
					<p className="text-muted-foreground">Loading...</p>
				) : chartData.length === 0 ? (
					<p className="text-muted-foreground">No data</p>
				) : (
					<ResponsiveContainer width="100%" height={300}>
						<BarChart data={chartData}>
							<CartesianGrid strokeDasharray="3 3" />
							<XAxis dataKey="name" />
							<YAxis />
							<Tooltip
								formatter={(value) => [`${Number(value).toFixed(2)}`, "Cost"]}
							/>
							<Bar dataKey="cost" />
						</BarChart>
					</ResponsiveContainer>
				)}
			</CardContent>
		</Card>
	);
}
