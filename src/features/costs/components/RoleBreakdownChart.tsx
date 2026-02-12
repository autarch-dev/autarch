/**
 * RoleBreakdownChart - Cost distribution by agent role
 *
 * Recharts PieChart showing how costs are distributed across agent roles.
 * Uses AGENT_ROLE_DISPLAY_LABELS for human-readable slice labels and distinct
 * colors per entry via Recharts Cell elements.
 */

import { useMemo } from "react";
import {
	Cell,
	Legend,
	Pie,
	PieChart,
	ResponsiveContainer,
	Tooltip,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AGENT_ROLE_DISPLAY_LABELS } from "@/shared/schemas/costs";
import { useCostStore } from "../store/costStore";

const COLORS = [
	"#6366f1",
	"#f59e0b",
	"#10b981",
	"#ef4444",
	"#8b5cf6",
	"#ec4899",
	"#14b8a6",
	"#f97316",
];

export function RoleBreakdownChart() {
	const { data, loading, error } = useCostStore((s) => s.byRole);

	const aggregated = useMemo(() => {
		const entries = data ?? [];
		const reviewSubs = entries.filter((e) => e.agentRole === "review_sub");
		if (reviewSubs.length === 0) return entries;

		const others = entries.filter((e) => e.agentRole !== "review_sub");
		const reviewEntry = others.find((e) => e.agentRole === "review");

		const merged = {
			agentRole: "review" as const,
			totalCost: reviewEntry?.totalCost ?? 0,
			promptTokens: reviewEntry?.promptTokens ?? 0,
			completionTokens: reviewEntry?.completionTokens ?? 0,
		};
		for (const sub of reviewSubs) {
			merged.totalCost += sub.totalCost;
			merged.promptTokens += sub.promptTokens;
			merged.completionTokens += sub.completionTokens;
		}

		if (reviewEntry) {
			return others.map((e) => (e.agentRole === "review" ? merged : e));
		}
		return [...others, merged];
	}, [data]);

	const chartData = aggregated.map((entry) => ({
		name: AGENT_ROLE_DISPLAY_LABELS[entry.agentRole] ?? entry.agentRole,
		value: entry.totalCost,
	}));

	return (
		<Card>
			<CardHeader>
				<CardTitle>Cost by Role</CardTitle>
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
						<PieChart>
							<Tooltip formatter={(value) => `$${Number(value).toFixed(2)}`} />
							<Legend />
							<Pie
								data={chartData}
								dataKey="value"
								nameKey="name"
								cx="50%"
								cy="50%"
								outerRadius={100}
								label={({ value }) => `$${Number(value).toFixed(2)}`}
							>
								{chartData.map((entry, index) => (
									<Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
								))}
							</Pie>
						</PieChart>
					</ResponsiveContainer>
				)}
			</CardContent>
		</Card>
	);
}
