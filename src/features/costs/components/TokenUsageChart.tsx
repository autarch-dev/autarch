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

function condenseFormatNumber(value: number): string {
	if (value >= 1000000) {
		return `${(value / 1000000)}M`;
	}
	if (value >= 1000) {
		return `${(value / 1000)}K`;
	}
	return value.toLocaleString();
}

export function TokenUsageChart() {
	const { data, loading, error } = useCostStore((s) => s.tokens);

	const chartData = (data ?? []).map((entry) => ({
		name: shortModelName(entry.modelId),
		uncachedPromptTokens: entry.uncachedPromptTokens,
		cacheReadTokens: entry.cacheReadTokens,
		cacheWriteTokens: entry.cacheWriteTokens,
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
							<YAxis tickFormatter={(value) => condenseFormatNumber(Number(value))} />
							<Tooltip formatter={(value) => Number(value).toLocaleString()} />
							<Legend />
							<Bar dataKey="uncachedPromptTokens" stackId="tokens" name="Uncached Prompt Tokens" fill="#6366f1" />
							{chartData.some((entry) => entry.cacheReadTokens) && <Bar dataKey="cacheReadTokens" stackId="tokens" name="Cache Read Tokens" fill="#8b5cf6" />}
							{chartData.some((entry) => entry.cacheWriteTokens) && <Bar dataKey="cacheWriteTokens" stackId="tokens" name="Cache Write Tokens" fill="#ec4899" />}
							<Bar
								dataKey="completionTokens"
								stackId="tokens"
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
