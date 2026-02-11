/**
 * TokenUsageChart - Token usage breakdown by model
 *
 * Recharts grouped BarChart showing prompt and completion tokens per model.
 * Two bars per model with a legend to distinguish token types.
 */

import {
	Bar,
	BarChart,
	CartesianGrid,
	Legend,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCostStore } from "../store/costStore";
import { shortModelName } from "../utils/formatModelName";

export function TokenUsageChart() {
	const { data, loading, error } = useCostStore((s) => s.tokens);

	const chartData = (data ?? []).map((entry) => ({
		name: shortModelName(entry.modelId),
		promptTokens: entry.promptTokens,
		completionTokens: entry.completionTokens,
	}));

	return (
		<Card>
			<CardHeader>
				<CardTitle>Token Usage</CardTitle>
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
						<BarChart data={chartData}>
							<CartesianGrid strokeDasharray="3 3" />
							<XAxis dataKey="name" />
							<YAxis />
							<Tooltip formatter={(value) => Number(value).toLocaleString()} />
							<Legend />
							<Bar dataKey="promptTokens" name="Prompt Tokens" fill="#6366f1" />
							<Bar
								dataKey="completionTokens"
								name="Completion Tokens"
								fill="#f59e0b"
							/>
						</BarChart>
					</ResponsiveContainer>
				)}
			</CardContent>
		</Card>
	);
}
