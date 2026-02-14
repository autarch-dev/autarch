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
import {
	AGENT_ROLE_DISPLAY_LABELS,
	type CostByRole,
} from "@/shared/schemas/costs";
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

function reduceIntoRole(
	entries: CostByRole,
	targetRole: string,
	shouldAggregate: (entry: CostByRole[number]) => boolean,
) {
	const targetEntry = entries.find((e) => e.agentRole === targetRole) ?? {
		agentRole: targetRole,
		totalCost: 0,
		promptTokens: 0,
		completionTokens: 0,
	};

	for (const entry of entries) {
		if (shouldAggregate(entry)) {
			targetEntry.totalCost += entry.totalCost;
			targetEntry.promptTokens += entry.promptTokens;
			targetEntry.completionTokens += entry.completionTokens;
		}
	}

	return entries.reduce<CostByRole>(
		(acc, e) => {
			if (shouldAggregate(e) || e.agentRole === targetRole) {
				return acc;
			}

			acc.push(e);
			return acc;
		},
		[targetEntry],
	);
}

export function RoleBreakdownChart() {
	const { data, loading, error } = useCostStore((s) => s.byRole);

	const aggregated = useMemo(() => {
		return reduceIntoRole(
			reduceIntoRole(data ?? [], "review", (e) => e.agentRole === "review_sub"),
			"roadmap_planning",
			(e) =>
				[
					"visionary",
					"iterative",
					"pathfinder",
					"tech_lead",
					"synthesis",
				].includes(e.agentRole),
		);
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
							<Tooltip
								formatter={(value) =>
									new Intl.NumberFormat("en-US", {
										style: "currency",
										currency: "USD",
									}).format(Number(value))
								}
							/>
							<Legend />
							<Pie
								data={chartData}
								dataKey="value"
								nameKey="name"
								cx="50%"
								cy="50%"
								outerRadius={100}
								label={({ value }) =>
									new Intl.NumberFormat("en-US", {
										style: "currency",
										currency: "USD",
									}).format(Number(value))
								}
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
